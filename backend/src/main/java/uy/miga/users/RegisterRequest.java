package uy.miga.users;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

record RegisterRequest(
    @NotBlank
    @Email
    String email,

    @NotBlank
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).{10,}$",
        message = "La contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula, número y carácter especial."
    )
    @Size(max = 128, message = "La contraseña admite hasta 128 caracteres.") String password
  ) {}
