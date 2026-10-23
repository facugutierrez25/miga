package uy.miga.users;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

record UpdateProfileRequest(
    @NotBlank String firstName,
    String lastName,
    LocalDate birthDate
) {}
