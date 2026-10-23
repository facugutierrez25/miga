package uy.miga.users;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {
    Optional<VerificationToken> findByToken(String token);
    void deleteByUser(User user);
}
