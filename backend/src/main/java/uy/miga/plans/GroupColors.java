package uy.miga.plans;

import java.util.Collection;
import java.util.List;

public final class GroupColors {
    private GroupColors() {}

    public record Color(String hex, String standardKey) {}

    public static final List<Color> PALETTE = List.of(
        new Color("#C0704A", "proteinas"),
        new Color("#A8822E", "cereales_tuberculos"),
        new Color("#B5627A", "frutas"),
        new Color("#4F86B8", "lacteos"),
        new Color("#8070B0", "aceites_grasas"),
        new Color("#4E8F6A", "verduras"),
        new Color("#368C91", null),
        new Color("#95715D", null),
        new Color("#6675A0", null),
        new Color("#AD5860", null));

    public static boolean contains(String color) {
        return color != null && PALETTE.stream().anyMatch(c -> c.hex().equalsIgnoreCase(color));
    }

    public static String forKey(String key) {
        return PALETTE.stream().filter(c -> c.standardKey() != null && c.standardKey().equals(key))
            .map(Color::hex).findFirst().orElse(null);
    }

    public static String next(Collection<String> used) {
        return PALETTE.stream().map(Color::hex)
            .filter(c -> used.stream().noneMatch(c::equalsIgnoreCase)).findFirst()
            .orElse(PALETTE.get(used.size() % PALETTE.size()).hex());
    }
}
