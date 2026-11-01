package uy.miga.time;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationTimeConfiguration {
    @Bean
    public Clock applicationClock(@Value("${app.time-zone:America/Montevideo}") String zone) {
        return Clock.system(ZoneId.of(zone));
    }
}
