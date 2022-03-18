/*
Here's a general outline of the data structure for labeled text.
This can be read (imported) and exported by this application. The
corresponding FOIA PDF workflow Django application also exports this
using the segmented PDF data. Any changes here need to be reflected
there.
 
 const download_data = {
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
*/
const VERSION = "2.0.0"
// NOTE: distinct pallette maker: https://mokole.com/palette.html
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
/*
Ten distinct colors

darkgreen
#006400
darkblue
#00008b
maroon3
#b03060
orangered
#ff4500
yellow
#ffff00
lime
#00ff00
aqua
#00ffff
fuchsia
#ff00ff
cornflower
#6495ed
navajowhite
#ffdead
*/

// label color lookup table for use in building spans
const label_colors = {};
labels.forEach((label) => {
  label_colors[label.label] = label.color;
});

/**
 * Main data structure of all documents w/ labels.
 *
 * NOTE: This gets exported via the foia-pdf-processing-system's
 * manage.py command: extract_autoextractable so any changes
 * here need to be reflected there.
 *
 * [
 *   {
 *     name: "Agency Name/path/to/file.pdf",
 *     segment: {
 *       index: 0,
 *       range: [1, 5]
 *     },
 *     has_labels: true,
 *     data: [{
 *       text: "word",
 *       id: 1
 *     }, {
 *       text: "another",
 *       id: 2,
 *       label: "ALLEG"
 *     }]
 *   },
 *   ...
 * ]
 */
let file_data = [];
// pointer into the labels array
let current_label = 0;
// pointer into the file_data array
let current_file_index = 0;
// toggles multi (range) select
let shift_held = false;
// facilitates multi select
let prev_click = null;

// Source: https://github.com/axa-group/nlp.js
class TreebankWordTokenizer {
  constructor(settings) {
    this.settings = settings || {};
    this.contractions2 = [
      /(.)('ll|'re|'ve|n't|'s|'m|'d)\b/gi,
      /\b(can)(not)\b/gi,
      /\b(D)('ye)\b/gi,
      /\b(Gim)(me)\b/gi,
      /\b(Gon)(na)\b/gi,
      /\b(Got)(ta)\b/gi,
      /\b(Lem)(me)\b/gi,
      /\b(Mor)('n)\b/gi,
      /\b(T)(is)\b/gi,
      /\b(T)(was)\b/gi,
      /\b(Wan)(na)\b/gi,
    ];
    this.contraction3 = [/\b(Whad)(dd)(ya)\b/gi, /\b(Wha)(t)(cha)\b/gi];
  }

  /**
   * Remove empty items at left at right of an array.
   * @param {string[]} arr Array to be trimmed.
   * @returns {string[]} Trimmed array.
   */
  trim(arr) {
    while (arr[arr.length - 1] === '') {
      arr.pop();
    }
    while (arr[0] === '') {
      arr.shift();
    }
    return arr;
  }

  applyRegexList(text, regexList, replaceValue) {
    let result = text;
    regexList.forEach(regex => {
      result = result.replace(regex, replaceValue);
    });
    return result;
  }

  tokenize(srcText) {
    let text = this.applyRegexList(srcText, this.contractions2, '$1 $2');
    text = this.applyRegexList(text, this.contraction3, '$1 $2 $3');
    text = text.replace(/([^\w.'\-/+<>,&])/g, ' $1 ');
    text = text.replace(/([^E])([\/\-])([^B])/g, '$1 $2 $3');
    text = text.replace(/(,\s)/g, ' $1');
    text = text.replace(/('\s)/g, ' $1');
    text = text.replace(/\. *(\n|$)/g, ' . ');
    text = text.replace(/([^\s])\./g, '$1 . ');
    const tokens = text.split(/\s+/);
    return tokens.filter(s => s);
  }
}

/**
 * Switch current label, by overall index in the labels list, so any
 * word clicked afterward will be labeled as such.
 */
function set_current_label(i) {
  console.log("Setting current label to", i);
  current_label = i;
  const buttons = document.querySelectorAll(".labeler-controls .label");
  buttons.forEach((btn, ii) => {
    if (ii !== i)
      btn.classList.remove("selected");
    else
      btn.classList.add("selected");
  });
}

function toggle_multi_select() {
  shift_held = !shift_held;
  document.querySelector(".multi-select .value").textContent = shift_held ? "on" : "off";
}

/**
 * Label a word, based on the click event
 * of a span enclosing a word
 */
function text_selected(event) {
  const selection = event.target.innerText;
  console.log("Word selected:", selection);
  const sel_id = Number.parseInt(event.target.id.split("-")[1]);
  // Mark this document at labeled to simplify post processing
  file_data[current_file_index].has_labels = true;
  file_data[current_file_index].data.forEach((word_data, i) => {
    if (sel_id !== word_data.id) return;
    console.log("Match", sel_id, "Word_data", word_data);
    // if already selected, de-select
    if (word_data.label && word_data.label === labels[current_label].label) {
      delete file_data[current_file_index].data[i].label;
      document.getElementById(`word-${word_data.id}`).style.backgroundColor = null;
    } else {
      file_data[current_file_index].data[i].label = labels[current_label].label;
      document.getElementById(`word-${word_data.id}`).style.backgroundColor = labels[current_label].color;
    }
  });
}

/**
 * Displays a document for labeling, based on the index in
 * the overall documents list.
 */
function display_document(index) {
  const {name, data} = file_data[index];

  // converts our list of tokens with labels to HTML
  // wach word_data should be an object of:
  // { text: "token", label: "ALLEG" }
  const html = data.map((word_data) => {
    const text = word_data.text.trim();
    const clean_word = text.replace(
      /([^\/])>/g, '$1&gt;'
    ).replace(
      /<([^b])/g, '&lt;$1'
    ).replace(
      /\s*&nbsp\s*/, '&nbsp'
    );
    if (text === "&nbsp") {
      // left aligned
      // return " ";
      return text;
    }
    if (text === "LINE-BREAK") {
      return "<br/>";
    }
    let label_prop = "";
    let color_prop = "";
    if (word_data.label) {
      label_prop = `label="${word_data.label}"`;
      color_prop = `style="background-color: ${label_colors[word_data.label]}"`;
    }
    return `<span class='word' ${label_prop} ${color_prop} id='word-${word_data.id}'>${clean_word}</span>`;
  }).filter(x=>x).join("");

  document.getElementById("document").innerHTML = html;

  // show the filename, not the entire path
  const path_parts = name.split("/");
  document.querySelector(".document-name").innerText = path_parts[path_parts.length-1];

  // show the segment (page range) if we have one
  if (data.segment) {
    let pages_desc = data.segment.range[0];
    if (data.segment[0] !== data.segment.range[1])
      pages_desc += ` to ${data.segment.range[1]}`;
    document.querySelector(".document-segment").innerText = `Pg: ${data.segment.range[0]}`;
  }

  // find the agency name based on a match of Police Department, etc
  let agency_name = null;
  path_parts.forEach((part) => {
    if (part.match(/Police Department/) || part.match(/Sheriff's Office/))
      document.querySelector(".agency-name").innerText = part;
  });

  document.querySelector(".document-n-current").innerText = index;
  document.querySelector(".document-n-total").innerText = file_data.length;

  // set up word click event handling
  document.querySelectorAll(".word").forEach((el) => {
    el.addEventListener("click", (e) => {
      console.log("shift_held", shift_held, "prev_click", prev_click);
      if (shift_held && prev_click) {
        const last_id = Number.parseInt(prev_click.id.split("-")[1]);
        console.log("last_id", last_id);
        const this_id = Number.parseInt(e.target.id.split("-")[1]);
        console.log("this_id", this_id);
        const [ start, end ] = [last_id, this_id].sort();
        console.log("end", end, "start", start);
        // +1 so we skip the already clicked and labeled word
        for (var id = start + 1; id <= end; id++) {
          const target = document.getElementById(`word-${id}`);
          console.log("Marking target", target);
          if (target) {
            text_selected({
              target: target
            });
          }
        }
        toggle_multi_select();
      } else {
        text_selected(e);
      }
      // display_document(current_file_index);
      prev_click = e.target;
    });
  });
}

function nextDocument() {
  if (current_file_index === (file_data.length - 1)) return;
  display_document(++current_file_index);
}

function prevDocument() {
  if (current_file_index === 0) return;
  display_document(--current_file_index);
}

/**
 * Main function for initializing and displaying the labeler.
 */
function setup_labeler(file_data) {
  document.querySelector(".labeler .next").addEventListener("click", nextDocument);
  document.querySelector(".labeler .prev").addEventListener("click", prevDocument);

  // initial document display
  display_document(current_file_index);
  document.querySelector(".labeler").classList.toggle("hide");

  // render the label selector buttons, these let us select
  // which label gets applied to words when clicked
  labels.forEach((label_data, i) => {
    const button = document.createElement("button");
    button.addEventListener("click", () => {
      set_current_label(i);
    });
    // button.textContent = label_data.label;
    button.innerHTML = `<span class="key-number">${i===0 ? "\`" : i}</span> ${label_data.label}`
    button.style.backgroundColor = label_data.color;
    button.className = "label";
    if (i === 0)
      button.className += " selected";
    document.querySelector(".labeler-controls").appendChild(button);
  });

  // set up key press to change label
  document.addEventListener("keyup", (e) => {
    console.log("Key up:", e.code);
    if (e.code === "Tab") {
      toggle_multi_select();
      return;
    } else if (e.code === "KeyN") {
      nextDocument();
    } else if (e.code === "KeyP") {
      prevDocument();
    }
    let digit = null;
    try {
      digit = e.code.match(/Digit([0-9])/)[1];
    } catch (e) {}
    if (e.code === 'Backquote') {
      digit = '0';
    }
    if (!digit) return;
    let i = current_label;
    try {
      i = Number.parseInt(digit);
    } catch(e) {
      return;
    }
    if (!labels[i]) return;
    set_current_label(i);
  });

}

/**
 * Remove any upload error message.
 */
function clear_message() {
  const msg_area = document.querySelector(".message-area");
  msg_area.innerText = "";
  msg_area.className = "";
}

/**
 * Display an error message from an upload/parse
 */
function show_message(message, error=false) {
  console.log("Displaying message:", message, "Error?", error);
  const msg_area = document.querySelector(".message-area");
  msg_area.innerText = message;
  if (error)
    msg_area.className = "error";
  else
    msg_area.className = "";
}

/**
 * Make sure this filename matches the extension given
 * in the extension filter input field.
 */
function check_extension(filename) {
  const ext = document.getElementById("file-extension").value;
  if (ext && filename.endsWith(ext)) {
    return true;
  }
  return false;
}

/**
 * Clean a piece of text for use as HTML directly.
 */
function tokenize_document(text) {
  const tokenizer = new TreebankWordTokenizer();
  const tokens = tokenizer.tokenize(text.replace(
    /\n/g, " LINE-BREAK "
  ).replace(
    /\s/g, " &nbsp "
  ).replace(
    /\r/g, ""
  ));
  let id = 0;
  return tokens.map((token, id) => {
    return {
      id: id++,
      text: token,
      // no labels so just leave it out to save space
      // label: null
    };
  });
}

/**
 * Read uploaded files into an array of objects with
 * name: filename, data: HTML-ized document text
 *
 * This populates the global file_data array.
 */
async function read_files(files) {
  for (let i = 0; i < files.length; ++i) {
    const file = files[i];
    if (!check_extension(file.name)) {
      continue;
    }
    const html = await file.text();
    console.log("File:", file.name, "Tokens:", html.length);
    // NOTE: we populate the global file_data here
    file_data.push({
      name: file.name,
      // no label here!
      data: tokenize_document(html),
    });
  }
}

/**
 * Entry point for multiple document uploader
 */
async function files_uploaded(e) {
  const files = e.target.files;
  await read_files(files);
  if (!file_data || !file_data.length) {
    show_message("We didn't get any files! Did you drop a directory? If so, you need to drag the individual files. Secondarily, make sure the extension matches that of the files you're dropping.", error=true);
    return;
  }
  document.querySelector(".file-loading").classList.toggle("hide");
  setup_labeler(file_data);
}

function migrate_document(data) {
  // we're going to tokenize our individual span texts because
  // they were just whitespace split, not proper tokenization
  const tokenizer = new TreebankWordTokenizer();

  // create a hidden container to dump our previously
  // marked up HTML so we can query all the spans
  const container = document.createElement("div");
  container.style.display = 'none';
  container.innerHTML = data;

  // convert our optinally labelled (via bg-color) spans
  // to token object lists
  const token_spans = container.querySelectorAll("span");
  const words = [];
  token_spans.forEach((el, id) => {
    let text = el.textContent;
    /**
     * This will never get triggered due to our selector query
     * if (el.tag !== "SPAN") {
     *     text = el.tag.toLowerCase();
     * }
     */
    const label = label_colors[el.style.backgroundColor];
    const tokens = tokenizer.tokenize(text);
    // words are objects of:
    // { text: "found" }
    // { text: "Respect", "label": "ALLEG" }
    tokens.forEach((token) => {
      const token_data = {
        text: token,
      };
      if (label) token_data.label = label;
      words.push(token_data);
    });
  });

  return words;
}

/**
 * Convert older versions to the new tokenized version.
 */
async function migrate(e) {
  const raw_data = await e.target.files[0].text();
  const data = JSON.parse(raw_data);

  // version 2.x is tokenized, skip for now
  // TODO: merge in new documents not already
  // in our currently loaded dataset
  if (data.version && data.version.startsWith("2.")) {
    data.file_data.forEach((file, index) => {
      if (file.data_raw) {
        file.data = tokenize_document(file.data_raw);
        delete file.data_raw;
      }
    });
    console.log("data", data);
    return data;
  }

  const new_file_data_map = {};
  // take from our uploaded file
  data.file_data.forEach(({name, data}) => {
    new_file_data_map[name] = migrate_document(data);
  });
  // take from our existing loaded documents
  file_data.forEach(({name, data}) => {
    // don't overwrite ones loaded from our uploaded file
    if (new_file_data_map[name]) return;
    new_file_data_map[name] = data;
  });

  // flatten and update our loaded data
  file_data = Object.keys(new_file_data_map).map((name) => {
    return {
      name, 
      data: new_file_data_map[name],
    };
  });
  display_document(current_file_index);

  document.getElementById("restore-modal").style.display = "none";
}

/**
 * A saved set of labeled documents, for restoring progress.
 */
async function json_uploaded(e) {
  const raw_data = await e.target.files[0].text();
  const data = JSON.parse(raw_data);
  file_data = data.file_data;
  if (data.labels) labels = data.labels;

  if (data.version && data.version.startsWith("2.")) {
    data.file_data.forEach((file, index) => {
      if (file.data_raw) {
        file.data = tokenize_document(file.data_raw);
        delete file.data_raw;
      }
    });
    console.log("data", data);
  }

  document.querySelector(".file-loading").classList.toggle("hide");
  setup_labeler(file_data);
}

/**
 * Compile and prompt the user to download all the current
 * data associated with this labeling session.
 */
function download_data(e) {
  const download_data = {
    labels: labels,
    version: VERSION,
    file_data: file_data,
  };
  const downloadFile = new Blob([JSON.stringify(download_data)], {
    type: 'text/json'
  });
  const fileURL = URL.createObjectURL(downloadFile);
  const ancorTag = document.createElement('a');
  ancorTag.href = fileURL;
  ancorTag.target = '_blank';
  ancorTag.download = 'ner-data.json';
  document.body.appendChild(ancorTag);
  ancorTag.click();
  document.body.removeChild(ancorTag);
}

// Initializers
document.getElementById("file-upload").addEventListener("change", files_uploaded);
document.getElementById("json-upload").addEventListener("change", json_uploaded);
document.querySelector(".labeler .download").addEventListener("click", download_data);
document.querySelector(".labeler .help").addEventListener("click", () => {
alert(`Welcome!

Keyboard shortcuts:
  Tab - Toggle multi select on/off
  n - next document
  p - previous document
  \`, 0-9 - Set current label

`);
});
/*
document.querySelector(".toggle-restore").addEventListener("click", (e) => {
  document.getElementById("restore-modal").style.display = "";
  document.getElementById("json-restore").addEventListener("change", migrate);
});
*/
