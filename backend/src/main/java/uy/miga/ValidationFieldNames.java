package uy.miga;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.util.ReflectionUtils;
import org.springframework.validation.BindingResult;

import java.util.regex.Pattern;

public final class ValidationFieldNames {
    private static final Pattern PROPERTY = Pattern.compile("[a-zA-Z_$][a-zA-Z0-9_$]*");

    private ValidationFieldNames() {}

    public static String jsonPath(BindingResult binding, String path) {
        var target = binding.getTarget();
        if (target == null) return path;
        var bean = new BeanWrapperImpl(target);
        var matcher = PROPERTY.matcher(path);
        return matcher.replaceAll(match -> {
            int start = match.start();
            Class<?> owner = start == 0 ? target.getClass() : bean.getPropertyType(path.substring(0, start - 1));
            var field = owner == null ? null : ReflectionUtils.findField(owner, match.group());
            var property = field == null ? null : field.getAnnotation(JsonProperty.class);
            return property == null || property.value().isEmpty() ? match.group() : property.value();
        });
    }
}
