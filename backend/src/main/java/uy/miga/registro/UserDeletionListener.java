package uy.miga.registro;

import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserDeletionRequested;

@Component("registroUserDeletionListener")
class UserDeletionListener {
    private final JdbcTemplate jdbc;

    UserDeletionListener(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // El orden respeta las FK: entradas, notas, hábitos, reglas y finalmente planes.
    @EventListener
    @Order(20)
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteUserData(UserDeletionRequested event) {
        jdbc.update("delete from meal_notes where user_id = ?", event.userId());
    }
}
