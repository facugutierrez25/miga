package uy.miga;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    private String run(String header, AtomicReference<String> seenInMdc) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/status");
        if (header != null) request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, header);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> seenInMdc.set(MDC.get(CorrelationIdFilter.MDC_KEY));
        filter.doFilter(request, response, chain);
        return response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
    }

    @Test
    void keepsAValidUuidFromTheClient() throws Exception {
        String id = UUID.randomUUID().toString();
        AtomicReference<String> mdc = new AtomicReference<>();

        assertThat(run(id, mdc)).isEqualTo(id);
        assertThat(mdc.get()).isEqualTo(id);
        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
    }

    @Test
    void replacesAnInvalidValueWithANewUuid() throws Exception {
        AtomicReference<String> mdc = new AtomicReference<>();

        String returned = run("abc\nINFO falso registro", mdc);

        assertThat(returned).doesNotContain("\n");
        assertThat(UUID.fromString(returned).toString()).isEqualTo(returned);
        assertThat(mdc.get()).isEqualTo(returned);
    }

    @Test
    void generatesOneWhenMissing() throws Exception {
        AtomicReference<String> mdc = new AtomicReference<>();

        String returned = run(null, mdc);

        assertThat(UUID.fromString(returned).toString()).isEqualTo(returned);
    }
}
