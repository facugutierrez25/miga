package uy.miga.users;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

interface UsersRepository extends JpaRepository<User, Long> {
    boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);
}
