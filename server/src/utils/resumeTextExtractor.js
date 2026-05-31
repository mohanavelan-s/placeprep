const zlib = require('zlib');

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function xmlToText(xml) {
  return normalizeText(
    decodeXmlEntities(xml)
      .replace(/<w:tab\s*\/>/gi, '\t')
      .replace(/<w:br\s*\/>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }

  return -1;
}

function readZipEntries(buffer) {
  const entries = [];
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    return entries;
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < totalEntries && offset < buffer.length - 46; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer, entry) {
  const localOffset = entry.localHeaderOffset;
  if (localOffset < 0 || localOffset > buffer.length - 30 || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataStart < 0 || dataEnd > buffer.length) {
    return null;
  }

  const data = buffer.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    return data;
  }

  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(data);
  }

  return null;
}

function extractDocxText(buffer) {
  const entries = readZipEntries(buffer);
  const documentEntries = entries.filter((entry) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/i.test(entry.fileName),
  );
  const textParts = [];

  documentEntries.forEach((entry) => {
    try {
      const content = readZipEntry(buffer, entry);
      if (content) {
        textParts.push(xmlToText(content.toString('utf8')));
      }
    } catch {
      // Ignore corrupt individual entries and continue with the rest of the document.
    }
  });

  return normalizeText(textParts.join('\n\n'));
}

function decodePdfLiteral(value) {
  let decoded = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\') {
      decoded += char;
      continue;
    }

    const next = value[index + 1];
    if (next === undefined) {
      break;
    }

    if (next === 'n') decoded += '\n';
    else if (next === 'r') decoded += '\r';
    else if (next === 't') decoded += '\t';
    else if (next === 'b') decoded += '\b';
    else if (next === 'f') decoded += '\f';
    else if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] || next;
      decoded += String.fromCharCode(parseInt(octal, 8));
      index += octal.length - 1;
    } else {
      decoded += next;
    }
    index += 1;
  }

  return decoded;
}

function extractPdfLiteralStrings(text) {
  const strings = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] !== '(') {
      index += 1;
      continue;
    }

    let depth = 1;
    let escaped = false;
    let value = '';
    index += 1;

    while (index < text.length && depth > 0) {
      const char = text[index];
      if (escaped) {
        value += `\\${char}`;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '(') {
        depth += 1;
        value += char;
      } else if (char === ')') {
        depth -= 1;
        if (depth > 0) {
          value += char;
        }
      } else {
        value += char;
      }
      index += 1;
    }

    const decoded = decodePdfLiteral(value);
    if (decoded.replace(/\s/g, '').length >= 2) {
      strings.push(decoded);
    }
  }

  return strings;
}

function extractPdfHexStrings(text) {
  const strings = [];
  const matches = text.matchAll(/(?<!<)<([0-9a-fA-F\s]{4,})>(?!>)/g);

  for (const match of matches) {
    const hex = match[1].replace(/\s+/g, '');
    if (hex.length % 2 !== 0 || hex.length > 4000) {
      continue;
    }

    try {
      const bytes = Buffer.from(hex, 'hex');
      const utf16Like = bytes.length >= 4 && bytes.subarray(0, Math.min(bytes.length, 20)).some((byte, index) => index % 2 === 0 && byte === 0);
      const decoded = utf16Like ? bytes.toString('utf16le') : bytes.toString('utf8');
      if (decoded.replace(/\s/g, '').length >= 2) {
        strings.push(decoded);
      }
    } catch {
      // Ignore malformed hex strings.
    }
  }

  return strings;
}

function inflatePdfStreams(buffer) {
  const text = buffer.toString('latin1');
  const streams = [];
  let offset = 0;

  while (offset < text.length) {
    const streamIndex = text.indexOf('stream', offset);
    if (streamIndex < 0) {
      break;
    }

    const dataStart = streamIndex + 'stream'.length + (text[streamIndex + 6] === '\r' && text[streamIndex + 7] === '\n' ? 2 : 1);
    const endIndex = text.indexOf('endstream', dataStart);
    if (endIndex < 0) {
      break;
    }

    const header = text.slice(Math.max(0, streamIndex - 700), streamIndex);
    if (/\/FlateDecode/i.test(header)) {
      const streamBuffer = buffer.subarray(dataStart, endIndex);
      try {
        streams.push(zlib.inflateSync(streamBuffer).toString('latin1'));
      } catch {
        try {
          streams.push(zlib.inflateRawSync(streamBuffer).toString('latin1'));
        } catch {
          // Some PDF streams are encrypted or use unsupported filters.
        }
      }
    }

    offset = endIndex + 'endstream'.length;
  }

  return streams;
}

function printableFallback(buffer) {
  return normalizeText(
    buffer
      .toString('utf8')
      .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ')
      .split(/\s{2,}/)
      .filter((part) => /[a-zA-Z]{3,}/.test(part))
      .join('\n'),
  );
}

function cleanPdfText(value) {
  return normalizeText(
    String(value || '')
      .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ')
      .replace(/\b(Tj|TJ|ET|BT|Tf|Td|Tm|rg|RG|obj|endobj|xref)\b/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

function extractPdfText(buffer) {
  const sources = [buffer.toString('latin1'), ...inflatePdfStreams(buffer)];
  const parts = [];

  sources.forEach((source) => {
    parts.push(...extractPdfLiteralStrings(source));
    parts.push(...extractPdfHexStrings(source));
  });

  const extracted = cleanPdfText(parts.join('\n'));
  return extracted.length >= 40 ? extracted : printableFallback(buffer);
}

function extractLegacyDocText(buffer) {
  return printableFallback(buffer);
}

function extractTextFromFile(file) {
  if (!file?.buffer) {
    return {
      text: '',
      method: 'none',
      message: 'No resume file was provided.',
    };
  }

  const mimeType = String(file.mimetype || '').toLowerCase();
  const fileName = String(file.originalname || '').toLowerCase();

  try {
    if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      return {
        text: normalizeText(file.buffer.toString('utf8')),
        method: 'txt',
        message: 'Text resume extracted directly from the uploaded TXT file.',
      };
    }

    if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
      const text = extractDocxText(file.buffer);
      return {
        text,
        method: 'docx',
        message: text
          ? 'Resume text extracted automatically from the uploaded DOCX file.'
          : 'DOCX text extraction found no readable body text.',
      };
    }

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const text = extractPdfText(file.buffer);
      return {
        text,
        method: 'pdf',
        message: text
          ? 'Resume text extracted automatically from the uploaded PDF file.'
          : 'PDF text extraction found no readable text. Scanned PDFs may need OCR.',
      };
    }

    if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
      const text = extractLegacyDocText(file.buffer);
      return {
        text,
        method: 'doc',
        message: text
          ? 'Legacy DOC text was extracted with a best-effort parser.'
          : 'Legacy DOC extraction found no readable text.',
      };
    }
  } catch (error) {
    return {
      text: '',
      method: 'failed',
      message: `Automatic resume extraction failed: ${error.message}`,
    };
  }

  return {
    text: '',
    method: 'unsupported',
    message: 'This resume file type is stored, but automatic text extraction is not supported yet.',
  };
}

function extractResumeText(file, providedText) {
  const fileExtraction = extractTextFromFile(file);
  const pastedText = normalizeText(providedText);
  let text = fileExtraction.text;
  let method = fileExtraction.method;
  let message = fileExtraction.message;

  if (pastedText) {
    text = text && !text.includes(pastedText)
      ? `${text}\n\nAdditional pasted resume notes:\n${pastedText}`
      : (text || pastedText);
    method = text === pastedText ? 'manual' : `${method}+manual`;
    message = fileExtraction.text
      ? `${fileExtraction.message} Optional pasted text was also included.`
      : 'Resume text came from the pasted text field.';
  }

  return {
    text: normalizeText(text),
    method,
    message,
    extractedChars: normalizeText(text).length,
  };
}

module.exports = {
  extractResumeText,
  extractTextFromFile,
  normalizeText,
};
