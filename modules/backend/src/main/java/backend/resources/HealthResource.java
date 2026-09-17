package backend.resources;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets the desktop app tell this service apart from anything else on the port.
 * Bump API_VERSION whenever a change would break a client built for the previous one.
 */
@RestController
public class HealthResource {
    public static final String APPLICATION = "storage-analyzer";
    public static final int API_VERSION = 1;

    public record Health(String application, int apiVersion, String status) { }

    @GetMapping("/health")
    public Health health() {
        return new Health(APPLICATION, API_VERSION, "UP");
    }
}
