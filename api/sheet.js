// Vercel Serverless Function
// Fetches one tab of the Google Sheet as CSV, server-side (no browser CORS issues),
// and hands it back to the dashboard.
//
// Tabs are looked up by their internal gid (a stable numeric ID), not by name -
// this avoids a quirk where Google's older name-based lookup can return the
// wrong tab's data. If you ever add/rename a tab, update GID_BY_NAME below
// (find each gid by clicking the tab in Google Sheets and reading the #gid=...
// at the end of the browser's address bar).
//
// If you ever copy this dashboard for a DIFFERENT Google Sheet, change SHEET_ID
// and every gid below.

const SHEET_ID = "1AnkarjP3UPPo5y8GbIsPnlqpjLN4d36Uql_tu0Egf8M";

const GID_BY_NAME = {
  "Company Master": "890703876",
  "Outreach Log": "813992018",
  "Meetings & Appointments": "536630488",
  "Monthly Performance": "1036662807",
  "Mentees Status": "1320399630",
  "LinkedIn Connections": "2053223702"
};

// A quick sanity check: each tab's data should start with its own first
// column header. If Google ever hands back the wrong tab, this catches it
// immediately instead of silently showing wrong or empty data on the dashboard.
const EXPECTED_FIRST_HEADER = {
  "Company Master": "Company Name",
  "Outreach Log": "Date",
  "Meetings & Appointments": "Company Name",
  "Monthly Performance": "Month",
  "Mentees Status": "Name",
  "LinkedIn Connections": "First Name"
};

module.exports = async function handler(req, res) {
  const name = req.query.name;
  if (!name) {
    res.status(400).send("Missing ?name= parameter (the sheet tab name)");
    return;
  }

  const gid = GID_BY_NAME[name];
  if (!gid) {
    res.status(400).send(
      "'" + name + "' isn't a tab this dashboard knows the gid for. " +
      "Check GID_BY_NAME in api/sheet.js."
    );
    return;
  }

  const url =
    "https://docs.google.com/spreadsheets/d/" +
    SHEET_ID +
    "/gviz/tq?tqx=out:csv&gid=" +
    gid;

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      res.status(502).send(
        "Could not read the '" + name + "' tab (status " + upstream.status + "). " +
        "Make sure the Google Sheet is shared as 'Anyone with the link - Viewer'."
      );
      return;
    }
    const csvText = await upstream.text();

    const expectedHeader = EXPECTED_FIRST_HEADER[name];
    if (expectedHeader) {
      const startsRight =
        csvText.startsWith('"' + expectedHeader) || csvText.startsWith(expectedHeader);
      if (!startsRight) {
        res.status(502).send(
          "The '" + name + "' tab came back looking like the wrong sheet " +
          "(expected a column starting with '" + expectedHeader + "'). " +
          "Double check the gid for '" + name + "' in api/sheet.js still matches " +
          "the tab in Google Sheets (click the tab, check the URL's #gid=... value)."
        );
        return;
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(csvText);
  } catch (err) {
    res.status(500).send("Server error fetching the sheet: " + (err && err.message ? err.message : String(err)));
  }
};
