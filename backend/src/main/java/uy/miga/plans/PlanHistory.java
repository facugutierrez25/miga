package uy.miga.plans;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

final class PlanHistory {
    private record Group(UUID uid, String name, String abbreviation, String color, int order) {}
    private record MealSignature(String name, List<Integer> weekdays, Map<UUID, BigDecimal> portions) {}
    private record Signature(List<Group> groups, List<MealSignature> meals) {}
    private record Period(Plan plan, Signature signature, OffsetDateTime start, OffsetDateTime end) {}

    static List<PlanSummaryDto> collapse(List<Plan> versions, ZoneId zone) {
        var periods = new ArrayList<Period>();
        Signature current = versions.stream().filter(Plan::isCurrent).map(PlanHistory::signature).findFirst().orElse(null);
        for (Plan plan : versions.stream().filter(p -> !p.isCurrent())
                .sorted(Comparator.comparing(Plan::getCreatedAt).thenComparing(Plan::getId)).toList()) {
            Signature signature = signature(plan);
            if (!periods.isEmpty() && periods.getLast().signature().equals(signature)) {
                Period previous = periods.removeLast();
                periods.add(new Period(plan, signature, previous.start().isBefore(plan.getCreatedAt()) ? previous.start() : plan.getCreatedAt(),
                    previous.end().isAfter(plan.getSupersededAt()) ? previous.end() : plan.getSupersededAt()));
            } else periods.add(new Period(plan, signature, plan.getCreatedAt(), plan.getSupersededAt()));
        }
        if (!periods.isEmpty() && periods.getLast().signature().equals(current)) periods.removeLast();
        Collections.reverse(periods);
        return periods.stream().limit(50).map(period -> {
            Plan plan = period.plan();
            var groups = plan.getFoodGroups().stream().map(g -> new PlanFoodGroupDto(g.getId(), g.getName(), g.getAbbreviation(),
                g.getDisplayOrder(), g.getColor(), g.getClave(), g.isPreguntarSiFalta(), g.isOpcional(), g.getUid())).toList();
            var meals = orderedMeals(plan).stream().map(m -> new MealSummaryDto(m.getName(), m.getPortions().stream()
                .filter(p -> p.getPortions().signum() > 0).map(p -> new MealPortionDto(p.getFoodGroupId(), p.getPortions())).toList())).toList();
            return new PlanSummaryDto(period.start().atZoneSameInstant(zone).toLocalDate(), period.end().atZoneSameInstant(zone).toLocalDate(),
                meals.size(), groups, meals);
        }).toList();
    }

    private static List<Meal> orderedMeals(Plan plan) {
        return plan.getMeals().stream().sorted(Comparator.comparingInt(Meal::getDisplayOrder)).toList();
    }

    private static Signature signature(Plan plan) {
        var uids = plan.getFoodGroups().stream().collect(Collectors.toMap(PlanFoodGroup::getId, PlanFoodGroup::getUid));
        var groups = plan.getFoodGroups().stream().sorted(Comparator.comparing(PlanFoodGroup::getUid))
            .map(g -> new Group(g.getUid(), g.getName(), g.getAbbreviation(), g.getColor(), g.getDisplayOrder())).toList();
        var meals = orderedMeals(plan).stream().map(m -> new MealSignature(m.getName(), Weekdays.toList(m.getWeekdays()),
            m.getPortions().stream().filter(p -> p.getPortions().signum() > 0)
                .collect(Collectors.toMap(p -> uids.get(p.getFoodGroupId()), p -> p.getPortions().stripTrailingZeros())))).toList();
        return new Signature(groups, meals);
    }
}
