package com.placeprep;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class OAuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testAuthorizeRequiresPkce() throws Exception {
        mockMvc.perform(get("/oauth/authorize")
                .param("response_type", "code")
                .param("client_id", "local-mcp-test")
                .param("redirect_uri", "http://127.0.0.1:3000/oauth/callback")
                .param("state", "test-state"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testAuthorizeRendersConsentHtml() throws Exception {
        // Valid PKCE S256 challenge (43-128 chars base64url)
        String challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

        mockMvc.perform(get("/oauth/authorize")
                .param("response_type", "code")
                .param("client_id", "local-mcp-test")
                .param("redirect_uri", "http://127.0.0.1:3000/oauth/callback")
                .param("state", "test-state-123")
                .param("code_challenge", challenge)
                .param("code_challenge_method", "S256")
                .param("scope", "placeprep.profile.read placeprep.tasks.read"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("Authorize PlacePrep MCP Connector")))
                .andExpect(content().string(containsString("local-mcp-test")))
                .andExpect(content().string(containsString("placeprep.profile.read")));
    }

    @Test
    void testTokenEndpointRejectsMissingParams() throws Exception {
        mockMvc.perform(post("/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("grant_type", "authorization_code"))
                .andExpect(status().isBadRequest());
    }
}
