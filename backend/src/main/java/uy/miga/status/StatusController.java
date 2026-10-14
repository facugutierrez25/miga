package uy.miga.status;

import java.time.OffsetDateTime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/status")
class StatusController {

    private final JdbcTemplate jdbcTemplate;
    private final String appName;
    private final String appVersion;

    StatusController(JdbcTemplate jdbcTemplate,
                     @Value("${spring.application.name}") String appName,
                     @Value("${app.version}") String appVersion) {
        this.jdbcTemplate = jdbcTemplate;
        this.appName = appName;
        this.appVersion = appVersion;
    }

    @GetMapping
    StatusResponse status() {
        OffsetDateTime serverTime = jdbcTemplate.queryForObject("select now()", OffsetDateTime.class);
        return new StatusResponse(appName, appVersion, "OK", serverTime);
    }

    record StatusResponse(String app, String version, String database, OffsetDateTime serverTime) {
    }
}
