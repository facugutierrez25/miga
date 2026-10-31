package uy.miga.users;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;

record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(max = 128, message = "La contraseña admite hasta 128 caracteres.") String password
) {}
