package com.placeprep.controller;

import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.BillingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of("success", true, "data", billingService.getStatus()));
    }

    @GetMapping("/account")
    public ResponseEntity<Map<String, Object>> getAccount(@CurrentUser User user) {
        return ResponseEntity.ok(Map.of("success", true, "data", billingService.getAccount(user)));
    }

    @PostMapping({"/checkout", "/create-order"})
    public ResponseEntity<Map<String, Object>> createCheckout(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> req
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", billingService.createCheckoutSession(user, req != null ? req : Map.of())));
    }

    @PostMapping({"/verify", "/verify-payment"})
    public ResponseEntity<Map<String, Object>> verifyPayment(
            @CurrentUser User user,
            @RequestBody Map<String, Object> req
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", billingService.verifyPayment(user, req)));
    }

    @PostMapping("/webhook")
    public ResponseEntity<Map<String, Object>> webhook(
            @RequestBody(required = false) Map<String, Object> req,
            @RequestHeader(value = "x-razorpay-signature", required = false) String signature
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", billingService.handleWebhook(req, signature)));
    }

    @PostMapping("/portal")
    public ResponseEntity<Map<String, Object>> portal(@CurrentUser User user) {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("url", "/settings")));
    }
}
