package uy.miga.users;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class EmailVerificationIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private MockEmailService mockEmailService;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockEmailService.reset();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void verifyWithValidToken_returns200() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "verificar1@miga.uy", "password": "Segura1234!" }
                        """));

        String token = mockEmailService.getLastToken();

        mockMvc.perform(get("/api/v1/auth/verify?token=" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void verifyWithInvalidToken_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/auth/verify?token=token-inexistente"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void resend_alwaysReturns202() throws Exception {
        mockMvc.perform(post("/api/v1/auth/resend-verification")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        { "email": "cualquiera@miga.uy" }
                        """))
                .andExpect(status().isAccepted());
    }
}
