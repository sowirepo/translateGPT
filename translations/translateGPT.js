// Example of how to structure your translations file.

const settings = {
  settings: {
    sourceLanguage: "nl",
    useSourceTranslations: true,
    languages: [
      ["japanese", "jp"],
      ["dutch spoken informally specifically using je instead of u", "nl"],
      ["cat meows", "cat"],
      [`german using the informal "duzen"`, "de"],
    ],
    toTranslate: [
      [
        [
          "Confirm",
          "Shop",
          "Hamster Dance",
          "The hamsters are currently {{hamsterStatus}}, if you watch for {{time}}, maybe they'll do something else?",
        ],
        "app",
      ],
      [
        [
          "If you look hard enough, you'll find our mascot- Hambone the Hamster King!",
          "My favorite animal is a {{animal}}.",
        ],
        "shop",
      ],
    ],
  },
};

export default settings;
