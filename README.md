# NER Labeler

A little text labeler tool to help you build datasets for fine-tuning BERT/NLP models

Quickstart:

    python -m http.server 8080

Then visit the tool at [http://localhost:8080](http://localhost:8080)

## Loading Data and Setting Labels

This lets you load documents from a folder on disk or from a JSON export, using the first file selector (the one saying "Select or drop a folder, or one or more files, to tag"). After loading, the tool then lets you click on words, labeling them based on the currently selected entity from a global entities list. By default, the entities are set in the code (`index.js`) and look like this:

```
let labels = [
  {
    "label": "DDATE",
    "description": "Document date, e.g. \"Dec 24, 2021\"",
    "color": "#f286ff"
  },
  {
    "label": "IANO",
    "description": "IA Number",
    "color": "#2df3df"
  },
  {
    "label": "OFF",
    "description": "Begin subject officer, e.g. \"Officer John Smith\"",
    "color": "#1b9e77"
  },
  {
    "label": "DIS",
    "description": "Disposition, e.g. \"Sustained\"",
    "color": "#bce602"
  },
  {
    "label": "OUT",
    "description": "Begin outcome, e.g. \"Written Reprimand\"",
    "color": "#e6ab02"
  },
  {
    "label": "ALEG",
    "description": "Begin allgation, e.g. \"Misuse of property\"",
    "color": "#6686e6"
  },
  {
    "label": "IDATE",
    "description": "Incident date, e.g. \"Dec 24, 2021\"",
    "color": "#e7298a"
  }
];
```

## Loading Data from JSON

In addition to loading documents from a folder of plain text files, you can also load a JSON file which allows you to embed additional information. The format is like this:

```
{
  labels: [
    {
      label: "DDATE",
      description: 'Document date, e.g. "Dec 24, 2021"',
      color: "#f286ff",
    },
    {
      ...
    }
  ],
  version: VERSION,
  file_data: [
    {
      name: "Agency Name/path/to/file.pdf",
      segment: {
        index: 0,
        range: [1, 5]
      },
      has_labels: true,
      data_raw: "Raw document text",
      data: [{
        text: "word",
        id: 1
      },
      ...
      {
        text: "another",
        id: 99,
        label: "ALLEG"
      }]
    },
    ...
  ]
};
```

To import data in this format, use the second/bottom file field (the field labeled "Or restore a previous/JSON NER labeling session"). This format also happens to be the same format you'll receive if you save a labeled document set using the "Download" functionality in the tool.
