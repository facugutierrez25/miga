package uy.miga.users;

import jakarta.validation.constraints.NotBlank;

record DeleteAccountRequest(@NotBlank String password) {}
