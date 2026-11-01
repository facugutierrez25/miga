package uy.miga.users;

// Los listeners se ejecutan en orden y dentro de la transacción del borrado.
public record UserDeletionRequested(Long userId) {}
