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
  namespaces: ["app", "shop"],
};
