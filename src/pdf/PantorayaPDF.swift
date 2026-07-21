import Foundation
import AppKit
import PDFKit
import Darwin

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

func progress(_ value: Int) {
    print("PROGRESS \(value)")
    fflush(stdout)
}

guard CommandLine.arguments.count == 4 else {
    fail("Usage: PantorayaPDF <input> <output> <high|light|document>")
}

guard #available(macOS 13.4, *) else {
    fail("PDF compression requires macOS 13.4 or later.")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let operation = CommandLine.arguments[3]

guard operation == "high" || operation == "light" || operation == "document" else {
    fail("Unknown PDF operation.")
}

if operation == "document" {
    let extensionName = inputURL.pathExtension.lowercased()
    let documentTypes: [String: NSAttributedString.DocumentType] = [
        "doc": .docFormat,
        "docx": .officeOpenXML,
        "txt": .plain,
        "rtf": .rtf,
        "odt": .openDocument
    ]
    guard let documentType = documentTypes[extensionName] else {
        fail("Unsupported document format.")
    }
    let attributedDocument: NSAttributedString
    do {
        attributedDocument = try NSAttributedString(
            url: inputURL,
            options: [.documentType: documentType],
            documentAttributes: nil
        )
    } catch {
        fail("The Word document could not be opened.")
    }

    progress(20)
    let printInfo = NSPrintInfo()
    printInfo.paperSize = NSSize(width: 595, height: 842)
    printInfo.topMargin = 50
    printInfo.bottomMargin = 50
    printInfo.leftMargin = 50
    printInfo.rightMargin = 50
    printInfo.horizontalPagination = .fit
    printInfo.verticalPagination = .automatic
    printInfo.isHorizontallyCentered = false
    printInfo.isVerticallyCentered = false
    printInfo.jobDisposition = .save
    printInfo.dictionary()[NSPrintInfo.AttributeKey.jobSavingURL] = outputURL

    let printableWidth = printInfo.paperSize.width - printInfo.leftMargin - printInfo.rightMargin
    let textView = NSTextView(frame: NSRect(x: 0, y: 0, width: printableWidth, height: 1))
    textView.textStorage?.setAttributedString(attributedDocument)
    textView.isHorizontallyResizable = false
    textView.isVerticallyResizable = true
    textView.textContainer?.widthTracksTextView = true
    textView.textContainer?.containerSize = NSSize(width: printableWidth, height: .greatestFiniteMagnitude)
    textView.sizeToFit()

    progress(55)
    let printOperation = NSPrintOperation(view: textView, printInfo: printInfo)
    printOperation.showsPrintPanel = false
    printOperation.showsProgressPanel = false
    guard printOperation.run(), FileManager.default.fileExists(atPath: outputURL.path) else {
        fail("The PDF could not be created.")
    }
    progress(100)
    exit(0)
}

guard let document = PDFDocument(url: inputURL), document.pageCount > 0 else {
    fail("The PDF could not be opened.")
}

guard !document.isLocked else {
    fail("Password-protected PDFs are not supported yet.")
}

progress(15)

var options: [PDFDocumentWriteOption: Any] = [
    .saveImagesAsJPEGOption: true
]

if operation == "light" {
    options[.optimizeImagesForScreenOption] = true
}

progress(45)

guard document.write(to: outputURL, withOptions: options) else {
    fail("The compressed PDF could not be written.")
}

progress(100)
