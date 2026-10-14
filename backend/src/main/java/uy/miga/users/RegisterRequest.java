package uy.miga.users;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

record RegisterRequest(
    @NotBlank
    @Email
    String email,

    @NotBlank
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).{10,}$",
        message = "Password must be at least 10 characters and include uppercase, lowercase, number and special character"
    )
    String password
  ) {}
