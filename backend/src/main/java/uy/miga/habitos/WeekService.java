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

    WeekService(PlanHabitRepository habitRepository,
                HabitLogRepository logRepository,
                FoodEntryFacade entryFacade,
                PlanService planService,
                UserService userService) {
        this.habitRepository = habitRepository;
        this.logRepository = logRepository;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    WeekSummaryDto getWeek(String email, LocalDate refDate) {
        Long userId = userService.findUserIdByEmail(email);
        LocalDate weekStart = refDate.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        Long planId;
        try {
            planId = planService.getCurrentPlanId(email);
        } catch (Exception e) {
            planId = null;
        }

        List<HabitDto> habits = planId == null ? List.of() :
            habitRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream()
                .map(this::toDto)
                .toList();

        BigDecimal totalGoal = planId == null ? BigDecimal.ZERO : computeTotalGoal(planId);

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

            List<HabitLogDto> habitLogs = logsByDate.getOrDefault(day, List.of()).stream()
                .map(l -> new HabitLogDto(l.getPlanHabitId(), l.getLogDate(), l.getValue()))
                .toList();

            days.add(new WeekDayDto(day, hasData, totalRecorded, totalGoal, habitLogs));
        }

        return new WeekSummaryDto(weekStart, weekEnd, habits, days);
    }

    @Transactional(readOnly = true)
    List<HabitDto> getHabits(String email) {
        Long planId;
        try {
            planId = planService.getCurrentPlanId(email);
        } catch (Exception e) {
            return List.of();
        }
        return habitRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream()
            .map(this::toDto).toList();
    }

    @Transactional
    HabitDto createHabit(String email, HabitSaveDto dto) {
        Long planId = planService.getCurrentPlanId(email);
        PlanHabit habit = new PlanHabit();
        habit.setPlanId(planId);
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
        PlanHabit habit = habitRepository.findById(habitId).orElseThrow();
        Long planId = planService.getCurrentPlanId(email);
        if (!habit.getPlanId().equals(planId)) {
            throw new IllegalArgumentException("Hábito no pertenece al plan activo.");
        }
        HabitLog log = logRepository.findByUserIdAndPlanHabitIdAndLogDate(userId, habitId, date)
            .orElseGet(() -> {
                HabitLog l = new HabitLog();
                l.setUserId(userId);
                l.setPlanHabitId(habitId);
                l.setLogDate(date);
                return l;
            });
        log.setValue(value);
        logRepository.save(log);
        return new HabitLogDto(habitId, date, value);
    }

    private HabitDto toDto(PlanHabit h) {
        return new HabitDto(h.getId(), h.getName(), h.getHabitType().name(),
            h.getUnit(), h.getDailyGoal(), h.getStep(), h.getPeriod(), h.getDisplayOrder());
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
