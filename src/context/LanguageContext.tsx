import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";
import {
  getUiLanguageOption,
  normalizeUiLanguage,
  translateUiText,
  UI_LANGUAGE_STORAGE_KEY,
  type UiLanguage,
} from "@/lib/ui-language";

interface LanguageContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const ORIGINAL_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTRIBUTES = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

function readStoredLanguage() {
  if (typeof window === "undefined") {
    return "english";
  }

  return normalizeUiLanguage(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
}

function getUserLanguage(user: ReturnType<typeof useAuth>["user"]) {
  return normalizeUiLanguage(
    user?.preferredLanguage
      || user?.coachMetadata?.preferredLanguage
      || user?.coachMetadata?.prepArchitectLanguage,
  );
}

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || !node.textContent?.trim()) {
    return true;
  }

  if (parent.closest("[data-no-translate], [data-pp-no-translate]")) {
    return true;
  }

  return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"].includes(parent.tagName);
}

function updateTextNode(node: Text, language: UiLanguage) {
  if (shouldSkipTextNode(node)) {
    return;
  }

  if (!ORIGINAL_TEXT.has(node)) {
    ORIGINAL_TEXT.set(node, node.textContent || "");
  }

  const original = ORIGINAL_TEXT.get(node) || "";
  const translated = translateUiText(original, language);

  if (node.textContent !== translated) {
    node.textContent = translated;
  }
}

function getOriginalAttribute(element: Element, attributeName: string) {
  let attributeMap = ORIGINAL_ATTRIBUTES.get(element);

  if (!attributeMap) {
    attributeMap = new Map<string, string>();
    ORIGINAL_ATTRIBUTES.set(element, attributeMap);
  }

  if (!attributeMap.has(attributeName)) {
    attributeMap.set(attributeName, element.getAttribute(attributeName) || "");
  }

  return attributeMap.get(attributeName) || "";
}

function updateElementAttributes(element: Element, language: UiLanguage) {
  if (element.closest("[data-no-translate], [data-pp-no-translate]")) {
    return;
  }

  TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
    if (!element.hasAttribute(attributeName)) {
      return;
    }

    const original = getOriginalAttribute(element, attributeName);
    const translated = translateUiText(original, language);

    if (element.getAttribute(attributeName) !== translated) {
      element.setAttribute(attributeName, translated);
    }
  });
}

function translateTree(root: Node, language: UiLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateTextNode(root as Text, language);
    return;
  }

  if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document)) {
    return;
  }

  if (root instanceof Element) {
    updateElementAttributes(root, language);
  }

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = textWalker.nextNode();
  while (currentNode) {
    updateTextNode(currentNode as Text, language);
    currentNode = textWalker.nextNode();
  }

  if (root instanceof Element || root instanceof Document) {
    const elements = root.querySelectorAll(`[${TRANSLATABLE_ATTRIBUTES.join("], [")}]`);
    elements.forEach((element) => updateElementAttributes(element, language));
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const applyingRef = useRef(false);
  const [language, setLanguageState] = useState<UiLanguage>(() => readStoredLanguage());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hasStoredPreference = Boolean(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
    const userLanguage = getUserLanguage(user);

    if (!hasStoredPreference && userLanguage !== "english") {
      setLanguageState(userLanguage);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = getUiLanguageOption(language).htmlLang;

    const applyTranslations = (root: Node = document.body) => {
      applyingRef.current = true;
      try {
        translateTree(root, language);
      } finally {
        applyingRef.current = false;
      }
    };

    applyTranslations();

    const observer = new MutationObserver((mutations) => {
      if (applyingRef.current) {
        return;
      }

      applyingRef.current = true;
      try {
        mutations.forEach((mutation) => {
          if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
            ORIGINAL_TEXT.set(mutation.target as Text, mutation.target.textContent || "");
            translateTree(mutation.target, language);
          }

          if (mutation.type === "attributes" && mutation.target instanceof Element && mutation.attributeName) {
            let attributeMap = ORIGINAL_ATTRIBUTES.get(mutation.target);
            if (!attributeMap) {
              attributeMap = new Map<string, string>();
              ORIGINAL_ATTRIBUTES.set(mutation.target, attributeMap);
            }
            attributeMap.set(mutation.attributeName, mutation.target.getAttribute(mutation.attributeName) || "");
            updateElementAttributes(mutation.target, language);
          }

          mutation.addedNodes.forEach((node) => translateTree(node, language));
        });
      } finally {
        applyingRef.current = false;
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  const setLanguage = useCallback((nextLanguage: UiLanguage) => {
    setLanguageState(normalizeUiLanguage(nextLanguage));
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (text: string) => translateUiText(text, language),
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
