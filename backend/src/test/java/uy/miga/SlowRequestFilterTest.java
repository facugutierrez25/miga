package uy.miga;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;

class SlowRequestFilterTest {
    @Test
    void logsSlowRequestWithPatternAndWithoutQueryString() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(SlowRequestFilter.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            var request = new MockHttpServletRequest("GET", "/api/v1/registro/2026-11-09");
            request.setQueryString("email=privado@example.com&token=secreto");
            new CorrelationIdFilter().doFilter(request, new MockHttpServletResponse(), (req, res) ->
                new SlowRequestFilter(-1).doFilter(req, res, (r, s) ->
                    r.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/v1/registro/{date}")));
            assertThat(appender.list).hasSize(1);
            assertThat(appender.list.getFirst().getLevel()).isEqualTo(ch.qos.logback.classic.Level.WARN);
            assertThat(appender.list.getFirst().getFormattedMessage())
                .contains("GET", "/api/v1/registro/{date}", "estado=200", "correlationId=")
                .doesNotContain("email", "token", "secreto", "2026-11-09", "correlationId=null");
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void doesNotLogFastRequest() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(SlowRequestFilter.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            new SlowRequestFilter(Long.MAX_VALUE).doFilter(new MockHttpServletRequest("GET", "/api/v1/status"),
                new MockHttpServletResponse(), (req, res) -> {});
            assertThat(appender.list).isEmpty();
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void sanitizesIdentifiersInFallbackPath() {
        assertThat(SlowRequestFilter.sanitizedPath("/api/123/2026-11-09/550e8400-e29b-41d4-a716-446655440000"))
            .isEqualTo("/api/{id}/{id}/{id}");
    }
}
