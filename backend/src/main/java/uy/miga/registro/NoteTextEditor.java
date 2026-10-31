package uy.miga.registro;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

final class NoteTextEditor {
    private record Fragment(int start, int end) {}

    static String removeMention(String text, List<String> mentions, int index) {
        if (index < 0 || index >= mentions.size() || mentions.stream().anyMatch(s -> s == null || s.isBlank())) {
            throw new IllegalArgumentException();
        }
        // Las menciones pueden venir en otro orden que el texto (p. ej. tras repartir un ítem en grupos),
        // así que cada fragmento se empareja con cualquier mención pendiente de igual texto.
        List<String> pending = new ArrayList<>(mentions);
        List<Fragment> fragments = new ArrayList<>();
        for (Fragment hard : split(text, 0, text.length(), InterpreterService.HARD_SEP)) {
            if (pending.remove(normalized(text, hard))) {
                fragments.add(hard);
                continue;
            }
            for (Fragment soft : split(text, hard.start(), hard.end(), InterpreterService.SOFT_SEP)) {
                if (!pending.remove(normalized(text, soft))) throw new IllegalArgumentException();
                fragments.add(soft);
            }
        }
        if (!pending.isEmpty()) throw new IllegalArgumentException();
        String wanted = mentions.get(index);
        int occurrence = (int) mentions.subList(0, index).stream().filter(wanted::equals).count();
        index = -1;
        for (int i = 0, seen = 0; i < fragments.size(); i++) {
            if (normalized(text, fragments.get(i)).equals(wanted) && seen++ == occurrence) index = i;
        }
        Fragment target = fragments.get(index);
        int start = index > 0 ? fragments.get(index - 1).end() : target.start();
        int end = index > 0 ? target.end()
            : fragments.size() > 1 ? fragments.get(1).start() : text.length();
        String result = text.substring(0, start) + text.substring(end);
        return result.replaceAll("\\s+", " ").strip()
            .replaceAll("([,;+])(?:[ \t]*[,;+])+", "$1")
            .replaceAll("^[,;+ ]+|[,;+ .]+$", "").strip();
    }

    private static String normalized(String text, Fragment fragment) {
        return InterpreterService.normalize(text.substring(fragment.start(), fragment.end()));
    }

    private static List<Fragment> split(String text, int start, int end, Pattern separator) {
        List<Fragment> result = new ArrayList<>();
        var matcher = separator.matcher(text).region(start, end);
        int at = start;
        while (matcher.find()) {
            add(text, result, at, matcher.start());
            at = matcher.end();
        }
        add(text, result, at, end);
        return result;
    }

    private static void add(String text, List<Fragment> result, int start, int end) {
        while (start < end && Character.isWhitespace(text.charAt(start))) start++;
        while (end > start && Character.isWhitespace(text.charAt(end - 1))) end--;
        if (start < end) result.add(new Fragment(start, end));
    }
}
