package uy.miga.users;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import uy.miga.MigaApplication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sesión persistente con refresh token en cookie (ADR 0004, issue #296). */
@SpringBootTest(classes = MigaApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class SessionIntegrationTest {

    private static final String ORIGIN = "http://localhost:5173";
    private static final String EMAIL = "sesion@miga.uy";

    @Autowired private WebApplicationContext context;
    @Autowired private MockEmailService mockEmailService;
    @Autowired private EmailOutboxWorker outboxWorker;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() throws Exception {
        mockEmailService.reset();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        mockMvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
            .content("{ \"email\": \"" + EMAIL + "\", \"password\": \"Segura1234!\" }"));
        outboxWorker.processJobs();
        String token = mockEmailService.getLastToken();
        if (token != null) mockMvc.perform(get("/api/v1/auth/verify?token=" + token));
    }

    private String loginCookie() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
                .content("{ \"email\": \"" + EMAIL + "\", \"password\": \"Segura1234!\" }"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").isString())
            .andReturn();
        return cookieValue(result);
    }

    private static String cookieValue(MvcResult result) {
        String header = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(header).startsWith(AuthCookies.NAME + "=");
        return header.substring(AuthCookies.NAME.length() + 1, header.indexOf(';'));
    }

    private MvcResult refresh(String cookie, String origin) throws Exception {
        var req = post("/api/v1/auth/refresh");
        if (cookie != null) req.cookie(new Cookie(AuthCookies.NAME, cookie));
        if (origin != null) req.header("Origin", origin);
        return mockMvc.perform(req).andReturn();
    }

    @Test
    void login_setsSecureHttpOnlyCookieScopedToAuth() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/users/login").contentType(MediaType.APPLICATION_JSON)
                .content("{ \"email\": \"" + EMAIL + "\", \"password\": \"Segura1234!\" }"))
            .andExpect(status().isOk()).andReturn();
        String header = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(header).contains("HttpOnly").contains("Secure").contains("SameSite=Strict")
            .contains("Path=/api/v1/auth").contains("Max-Age=");
    }

    @Test
    void refresh_rotatesTokenAndReturnsAccessToken() throws Exception {
        String first = loginCookie();
        MvcResult result = refresh(first, ORIGIN);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).contains("\"token\"");
        String second = cookieValue(result);
        assertThat(second).isNotEqualTo(first);
        assertThat(refresh(second, ORIGIN).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void refresh_withoutCookie_returns401() throws Exception {
        assertThat(refresh(null, ORIGIN).getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void refresh_withUnknownOrMissingOrigin_isRejected() throws Exception {
        String cookie = loginCookie();
        assertThat(refresh(cookie, "https://otro-sitio.example").getResponse().getStatus()).isEqualTo(403);
        assertThat(refresh(cookie, null).getResponse().getStatus()).isEqualTo(403);
        // El token sigue siendo válido: un pedido rechazado no lo consume.
        assertThat(refresh(cookie, ORIGIN).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void reusingRotatedTokenAfterGrace_revokesWholeFamily() throws Exception {
        String first = loginCookie();
        String second = cookieValue(refresh(first, ORIGIN));
        jdbc.update("update refresh_tokens set used_at = now() - interval '5 minutes' where token_hash = ?",
            RefreshTokenService.hash(first));

        assertThat(refresh(first, ORIGIN).getResponse().getStatus()).isEqualTo(401);
        assertThat(refresh(second, ORIGIN).getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void reusingRotatedTokenWithinGrace_doesNotRevokeFamily() throws Exception {
        String first = loginCookie();
        String second = cookieValue(refresh(first, ORIGIN));

        assertThat(refresh(first, ORIGIN).getResponse().getStatus()).isEqualTo(401);
        assertThat(refresh(second, ORIGIN).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void logout_revokesSessionAndClearsCookie() throws Exception {
        String cookie = loginCookie();
        MvcResult result = mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(new Cookie(AuthCookies.NAME, cookie)).header("Origin", ORIGIN))
            .andExpect(status().isNoContent()).andReturn();
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");

        assertThat(refresh(cookie, ORIGIN).getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void logout_withUnknownOrigin_isRejected() throws Exception {
        String cookie = loginCookie();
        mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(new Cookie(AuthCookies.NAME, cookie)).header("Origin", "https://otro-sitio.example"))
            .andExpect(status().isForbidden());
        assertThat(refresh(cookie, ORIGIN).getResponse().getStatus()).isEqualTo(200);
    }
}
