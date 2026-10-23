package uy.miga.users;

import java.time.LocalDate;

record UserProfileResponse(String email, String firstName, String lastName, LocalDate birthDate) {}
