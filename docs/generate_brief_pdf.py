#!/usr/bin/env python3
"""Generate a styled PDF from the OTG Legal Box Product Brief markdown."""

import os
import markdown
import weasyprint

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(SCRIPT_DIR, "PRODUCT_BRIEF.md")
PDF_PATH = os.path.join(SCRIPT_DIR, "OTG_Legal_Box_Product_Brief.pdf")

CSS = """
@page {
    size: A4;
    margin: 2cm 2.5cm;
    @bottom-center {
        content: "OTG Legal Box — Product Brief | April 2026";
        font-size: 8pt;
        color: #999;
    }
    @bottom-right {
        content: "Page " counter(page);
        font-size: 8pt;
        color: #999;
    }
}

body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
}

h1 {
    font-size: 22pt;
    color: #0d3b66;
    border-bottom: 3px solid #0d3b66;
    padding-bottom: 6pt;
    margin-top: 0;
}

h2 {
    font-size: 14pt;
    color: #0d3b66;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4pt;
    margin-top: 18pt;
}

h3 {
    font-size: 11pt;
    color: #2a5d8f;
    margin-top: 12pt;
}

blockquote {
    border-left: 3px solid #0d3b66;
    padding-left: 12pt;
    color: #555;
    font-style: italic;
    margin: 8pt 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 9.5pt;
}

th, td {
    border: 1px solid #ddd;
    padding: 6pt 8pt;
    text-align: left;
    vertical-align: top;
}

th {
    background-color: #0d3b66;
    color: white;
    font-weight: bold;
}

tr:nth-child(even) {
    background-color: #f7f9fc;
}

strong {
    color: #0d3b66;
}

code {
    background-color: #f0f0f0;
    padding: 1pt 4pt;
    border-radius: 3pt;
    font-size: 9pt;
}

hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 16pt 0;
}

ul, ol {
    margin: 6pt 0;
    padding-left: 20pt;
}

li {
    margin-bottom: 3pt;
}

p {
    margin: 6pt 0;
}
"""


def main():
    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_content = f.read()

    html_body = markdown.markdown(
        md_content,
        extensions=["tables", "smarty"],
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
{html_body}
</body>
</html>"""

    css = weasyprint.CSS(string=CSS)
    doc = weasyprint.HTML(string=html)
    doc.write_pdf(PDF_PATH, stylesheets=[css])
    print(f"PDF generated: {PDF_PATH}")


if __name__ == "__main__":
    main()
