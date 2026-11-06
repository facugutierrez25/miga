package uy.miga.habitos;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.intake.FoodEntryFacade;
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
        LocalDate weekStart = refDate.with(DayOfWeek.MONDAY);
        return buildRange(userService.findUserIdByEmail(email), weekStart, weekStart.plusDays(6)).summary();
    }

    // Datos para exportar un rango: la planilla, las porciones por grupo de cada día y lo no reconocido.
    @Transactional(readOnly = true)
    WeekExport.Data getExportData(String email, LocalDate from, LocalDate to, java.util.Set<String> incluir) {
        Long userId = userService.findUserIdByEmail(email);
        RangeData range = buildRange(userId, from, to);
        List<String> groupNames = new ArrayList<>();
        Map<Long, String> groupById = new java.util.HashMap<>();
        range.plans().values().stream().distinct().forEach(plan -> plan.groups().forEach(g -> {
            groupById.put(g.id(), g.name());
            if (!groupNames.contains(g.name())) groupNames.add(g.name());
        }));
        Map<LocalDate, Map<String, BigDecimal>> portions = new java.util.HashMap<>();
        for (var e : range.entries()) {
            if (e.foodGroupId() == null || e.portions() == null || !groupById.containsKey(e.foodGroupId())) continue;
            portions.computeIfAbsent(e.date(), d -> new java.util.HashMap<>())
                .merge(groupById.get(e.foodGroupId()), e.portions(), BigDecimal::add);
        }
        var sinRegla = incluir.contains(WeekExport.SIN_REGLA)
            ? registroService.getSinRegla(userId, from, to) : List.<uy.miga.registro.SinReglaDto>of();
        return new WeekExport.Data(range.summary(), incluir, groupNames, portions, sinRegla, userService.findFirstNameByEmail(email));
    }

    private record RangeData(WeekSummaryDto summary, Map<LocalDate, uy.miga.plans.PlanReadData> plans,
                             List<FoodEntryFacade.EntryData> entries) {}

    private RangeData buildRange(Long userId, LocalDate weekStart, LocalDate weekEnd) {
        Map<Long, HabitDto> weekHabits = new java.util.LinkedHashMap<>();
        List<HabitLog> weekLogs = logRepository.findByUserIdAndDateRange(userId, weekStart, weekEnd);
        Map<LocalDate, List<HabitLog>> logsByDate = weekLogs.stream()
            .collect(Collectors.groupingBy(HabitLog::getLogDate));

        var plansByDate = planService.getPlansForRange(userId, weekStart, weekEnd);
        var weekEntries = entryFacade.findByUserIdAndDateRange(userId, weekStart, weekEnd);
        var entriesByDate = weekEntries.stream().collect(Collectors.groupingBy(FoodEntryFacade.EntryData::date));
        var mealsByDate = registroService.getWeekMealsForRange(userId, weekStart, weekEnd, plansByDate, weekEntries);
        Map<Long, List<PlanHabit>> habitsByPlan = new java.util.HashMap<>();

        List<WeekDayDto> days = new ArrayList<>();
        long length = java.time.temporal.ChronoUnit.DAYS.between(weekStart, weekEnd) + 1;
        for (int i = 0; i < length; i++) {
            LocalDate day = weekStart.plusDays(i);
            List<FoodEntryFacade.EntryData> entries = entriesByDate.getOrDefault(day, List.of());
            boolean hasData = !entries.isEmpty();

            BigDecimal totalRecorded = entries.stream()
                .filter(e -> e.portions() != null && e.foodGroupId() != null)
                .map(FoodEntryFacade.EntryData::portions)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            var plan = plansByDate.get(day);
            var dayHabits = plan == null ? List.<PlanHabit>of() : habitsByPlan.computeIfAbsent(plan.id(), id -> habitRepository
                .findByPlanIdOrderByDisplayOrderAsc(id).stream().filter(h -> h.getArchivedAt() == null).toList());
            dayHabits.forEach(h -> weekHabits.putIfAbsent(h.getId(), toDto(h)));
            var meals = mealsByDate.getOrDefault(day, List.of());
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
            BigDecimal totalGoal = plan == null ? BigDecimal.ZERO : plan.totalGoal(day.getDayOfWeek());
            days.add(new WeekDayDto(day, hasData || meals.stream().anyMatch(m -> m.noteText() != null && !m.noteText().isBlank()),
                totalRecorded, totalGoal, habitLogs, meals, dayHabits.stream().map(PlanHabit::getId).toList()));
        }

        return new RangeData(new WeekSummaryDto(weekStart, weekEnd, List.copyOf(weekHabits.values()), days),
            plansByDate, weekEntries);
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
        HabitValidation.configuration(new HabitInput(dto.name(), dto.habitType(), dto.unit(), dto.dailyGoal(),
            dto.period() == null ? "DIA" : dto.period(), dto.step(), Boolean.TRUE.equals(dto.countsFlexibleMeals())));
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
        HabitValidation.log(habit.getHabitType(), value);
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
            h.getUnit(), h.getDailyGoal(), h.getStep(), h.getPeriod(), h.isCountsFlexibleMeals(), h.getDisplayOrder(), h.getUid());
    }

}
