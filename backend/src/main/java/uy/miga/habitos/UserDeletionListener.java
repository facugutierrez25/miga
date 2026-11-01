package uy.miga.habitos;

import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserDeletionRequested;

@Component("habitosUserDeletionListener")
class UserDeletionListener {
    private final JdbcTemplate jdbc;

    UserDeletionListener(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // El orden respeta las FK: entradas, notas, hábitos, reglas y finalmente planes.
    @EventListener
    @Order(30)
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteUserData(UserDeletionRequested event) {
        jdbc.update("delete from habit_logs where user_id = ? or plan_habit_id in (select h.id from plan_habits h join plans p on p.id=h.plan_id where p.user_id = ?)", event.userId(), event.userId());
        jdbc.update("delete from plan_habits where plan_id in (select id from plans where user_id = ?)", event.userId());
    }
}
