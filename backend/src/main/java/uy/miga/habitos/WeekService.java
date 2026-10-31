package uy.miga.habitos;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.MealPortionSummary;
import uy.miga.plans.PlanService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
class WeekService {

    private final PlanHabitRepository habitRepository;
    private final HabitLogRepository logRepository;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final UserService userService;
    private final uy.miga.registro.RegistroService registroService;

    WeekService(PlanHabitRepository habitRepository,
                HabitLogRepository logRepository,
                FoodEntryFacade entryFacade,
                PlanService planService,
                UserService userService, uy.miga.registro.RegistroService registroService) {
        this.habitRepository = habitRepository;
        this.logRepository = logRepository;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.userService = userService;
        this.registroService = registroService;
    }

    @Transactional(readOnly = true)
    WeekSummaryDto getWeek(String email, LocalDate refDate) {
        Long userId = userService.findUserIdByEmail(email);
        LocalDate weekStart = refDate.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        Map<Long, HabitDto> weekHabits = new java.util.LinkedHashMap<>();
        List<HabitLog> weekLogs = logRepository.findByUserIdAndDateRange(userId, weekStart, weekEnd);
        Map<LocalDate, List<HabitLog>> logsByDate = weekLogs.stream()
            .collect(Collectors.groupingBy(HabitLog::getLogDate));

        List<WeekDayDto> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = weekStart.plusDays(i);
            List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, day);
            boolean hasData = !entries.isEmpty();

            BigDecimal totalRecorded = entries.stream()
                .filter(e -> e.portions() != null && e.foodGroupId() != null)
                .map(FoodEntryFacade.EntryData::portions)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            Long planId = null;
            try {
                planId = planService.getPlanIdForDate(userId, day);
            } catch (uy.miga.plans.PlanNotFoundException ignored) { }
            var dayHabits = planId == null ? List.<PlanHabit>of() : habitRepository
                .findByPlanIdOrderByDisplayOrderAsc(planId).stream().filter(h -> h.getArchivedAt() == null).toList();
            dayHabits.forEach(h -> weekHabits.putIfAbsent(h.getId(), toDto(h)));
            var meals = planId == null ? List.<uy.miga.registro.WeekMealData>of() : registroService.getWeekMeals(email, day);
            long flexibleCount = meals.stream().mapToLong(uy.miga.registro.WeekMealData::flexibleCount).sum();
            List<HabitLogDto> habitLogs = new ArrayList<>();
            for (PlanHabit habit : dayHabits) {
                if (habit.isCountsFlexibleMeals()) {
                    habitLogs.add(new HabitLogDto(habit.getId(), day, BigDecimal.valueOf(flexibleCount)));
                } else {
                    logsByDate.getOrDefault(day, List.of()).stream()
                        .filter(l -> habit.getUid().equals(l.getHabitUid())).findFirst()
                        .ifPresent(l -> habitLogs.add(new HabitLogDto(habit.getId(), day, l.getValue())));
                }
            }
            BigDecimal totalGoal = planId == null || "LIBRE".equals(planService.getModoRegistro(planId))
                ? BigDecimal.ZERO : computeTotalGoal(planId);
            days.add(new WeekDayDto(day, hasData || meals.stream().anyMatch(m -> m.noteText() != null && !m.noteText().isBlank()),
                totalRecorded, totalGoal, habitLogs, meals, dayHabits.stream().map(PlanHabit::getId).toList()));
        }

        return new WeekSummaryDto(weekStart, weekEnd, List.copyOf(weekHabits.values()), days);
    }

    @Transactional(readOnly = true)
    List<HabitDto> getHabits(String email) {
        Long planId;
        try {
            planId = planService.getCurrentPlanId(email);
        } catch (Exception e) {
            return List.of();
        }
        return habitRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream().filter(h -> h.getArchivedAt() == null)
            .map(this::toDto).toList();
    }

    @Transactional
    HabitDto createHabit(String email, HabitSaveDto dto) {
        Long planId = planService.getCurrentPlanId(email);
        PlanHabit habit = new PlanHabit();
        habit.setPlanId(planId);
        habit.setCountsFlexibleMeals(Boolean.TRUE.equals(dto.countsFlexibleMeals()));
        habit.setName(dto.name());
        habit.setHabitType(HabitType.valueOf(dto.habitType()));
        habit.setUnit(dto.unit());
        habit.setDailyGoal(dto.dailyGoal());
        habit.setStep(dto.step() != null ? dto.step() : BigDecimal.ONE);
        habit.setPeriod(dto.period() != null ? dto.period() : "DIA");
        habit.setDisplayOrder(dto.displayOrder());
        return toDto(habitRepository.save(habit));
    }

    @Transactional
    HabitLogDto logHabit(String email, Long habitId, LocalDate date, BigDecimal value) {
        Long userId = userService.findUserIdByEmail(email);
        try {
            planService.lockCurrentPlan(userId);
        } catch (uy.miga.plans.PlanNotFoundException ignored) {
            // La validación posterior determina si el hábito se puede registrar.
        }
        PlanHabit habit = habitRepository.findById(habitId).orElseThrow();
        // Un día se registra contra el plan que regía ese día (ADR 0002), igual que lo muestra Semana.
        Long planId = planService.getPlanIdForDate(userId, date);
        if (!habit.getPlanId().equals(planId) || habit.getArchivedAt() != null) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "El hábito no pertenece al plan de ese día.");
        }
        if (habit.isCountsFlexibleMeals()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "Este hábito se calcula desde las comidas flexibles.");
        }
        HabitLog log = logRepository.findByUserIdAndHabitUidAndLogDate(userId, habit.getUid(), date)
            .orElseGet(() -> {
                HabitLog l = new HabitLog();
                l.setUserId(userId);
                l.setPlanHabitId(habitId);
                l.setHabitUid(habit.getUid());
                l.setLogDate(date);
                return l;
            });
        log.setPlanHabitId(habitId);
        log.setValue(value);
        logRepository.save(log);
        return new HabitLogDto(habitId, date, value);
    }

    private HabitDto toDto(PlanHabit h) {
        return new HabitDto(h.getId(), h.getName(), h.getHabitType().name(),
            h.getUnit(), h.getDailyGoal(), h.getStep(), h.getPeriod(), h.isCountsFlexibleMeals(), h.getDisplayOrder());
    }

    private BigDecimal computeTotalGoal(Long planId) {
        List<Long> mealIds = planService.getMealIds(planId);
        return mealIds.stream()
            .flatMap(mealId -> planService.getMealPortions(mealId).stream())
            .map(MealPortionSummary::portions)
            .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
