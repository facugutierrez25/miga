package uy.miga.status;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uy.miga.MigaApplication;

@SpringBootTest(classes = MigaApplication.class)
@ActiveProfiles("test")
class StatusIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StatusController statusController;

    @Test
    void flywayCreatesUsersTable() {
        Integer tablas = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'users'",
            Integer.class);

        assertThat(tablas).isEqualTo(1);
    }

    @Test
    void statusRespondsWithDatabaseConnected() {
        var response = statusController.status();

        assertThat(response.app()).isEqualTo("miga-backend");
        assertThat(response.database()).isEqualTo("OK");
        assertThat(response.serverTime()).isNotNull();
    }
}
