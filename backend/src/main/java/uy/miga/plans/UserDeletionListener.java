package uy.miga.plans;

import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserDeletionRequested;

@Component("plansUserDeletionListener")
class UserDeletionListener {
    private final JdbcTemplate jdbc;

    UserDeletionListener(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // El orden respeta las FK: entradas, notas, hábitos, reglas y finalmente planes.
    @EventListener
    @Order(50)
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteUserData(UserDeletionRequested event) {
        jdbc.update("delete from meal_portions where meal_id in (select m.id from meals m join plans p on p.id=m.plan_id where p.user_id = ?)", event.userId());
        jdbc.update("delete from meals where plan_id in (select id from plans where user_id = ?)", event.userId());
        jdbc.update("delete from plans where user_id = ?", event.userId());
    }
}
