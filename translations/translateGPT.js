// Example of how to structure your translations file.

export const config = {
  sourceLanguage: "en",
  languages: [
    {
      language: "dutch spoken informally specifically using je instead of u",
      abbreviation: "nl",
    },
    {
      language: `german using the informal "duzen"`,
      abbreviation: "de",
      sourceLanguage: "nl",
    },
    {
      language: "japanese",
      abbreviation: "jp",
    },
    {
      language: "cat meows",
      abbreviation: "cat",
    },
    {
      language: "english with a hamster accent",
      abbreviation: "hamster",
    },
  ],
  toTranslate: [
    {
      translateStrings: [
        "Confirm",
        "Shop",
        "Hamster Dance",
        "The hamsters are currently {{hamsterStatus}}, if you watch for {{time}}, maybe they'll do something else?",
      ],
      namespace: "app",
    },
    {
      translateStrings: [
        "If you look hard enough, you'll find our mascot- Hambone the Hamster King!",
        "My favorite animal is a {{animal}}.",
      ],
      namespace: "shop",
    },
  ],
};
