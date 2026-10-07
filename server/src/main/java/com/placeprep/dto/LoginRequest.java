package com.placeprep.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {

    private String identifier;
    private String email;

    @NotBlank(message = "Password is required.")
    private String password;

    public LoginRequest() {}

    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
