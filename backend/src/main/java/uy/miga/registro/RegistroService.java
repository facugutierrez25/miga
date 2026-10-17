package uy.miga.registro;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserService;

import java.time.LocalDate;
import java.util.List;

@Service
class RegistroService {

    private final RegistroRepository registroRepository;
    private final UserService userService;

    RegistroService(RegistroRepository registroRepository, UserService userService) {
        this.registroRepository = registroRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    List<Long> getTodayLog(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return registroRepository.findByUserIdAndLoggedDate(userId, LocalDate.now())
                .stream().map(MealLog::getMealId).toList();
    }

    @Transactional
    void markEaten(String email, Long mealId) {
        Long userId = userService.findUserIdByEmail(email);
        if (!registroRepository.existsByUserIdAndMealIdAndLoggedDate(userId, mealId, LocalDate.now())) {
            MealLog log = new MealLog();
            log.setUserId(userId);
            log.setMealId(mealId);
            log.setLoggedDate(LocalDate.now());
            registroRepository.save(log);
        }
    }

    @Transactional
    void unmarkEaten(String email, Long mealId) {
        Long userId = userService.findUserIdByEmail(email);
        registroRepository.deleteByUserIdAndMealIdAndLoggedDate(userId, mealId, LocalDate.now());
    }
}
