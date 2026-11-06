package uy.miga.habitos;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/** Embeds the app's wordmark as an image; no dependency on fonts installed in Excel. */
final class ExportLogo {
    private ExportLogo() {}

    static void addToWorkbook(Path source, OutputStream out, int sheets, byte[] logo) throws IOException {
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(logo));
        if (image == null) throw new IOException("El logo de Miga no es una imagen válida.");
        long width = 80L * 9525;
        long height = Math.round(width * (double) image.getHeight() / image.getWidth());
        try (var input = new ZipFile(source.toFile()); var zip = new ZipOutputStream(out)) {
            for (var entry : input.stream().toList()) {
                byte[] bytes;
                try (var stream = input.getInputStream(entry)) { bytes = stream.readAllBytes(); }
                String name = entry.getName();
                if (name.equals("[Content_Types].xml")) {
                    String types = new String(bytes, StandardCharsets.UTF_8);
                    StringBuilder additions = new StringBuilder("<Default Extension=\"png\" ContentType=\"image/png\"/>");
                    for (int sheet = 1; sheet <= sheets; sheet++) additions.append("<Override PartName=\"/xl/drawings/miga")
                        .append(sheet).append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/>");
                    bytes = types.replace("</Types>", additions + "</Types>").getBytes(StandardCharsets.UTF_8);
                }
                for (int sheet = 1; sheet <= sheets; sheet++) {
                    if (name.equals("xl/worksheets/sheet" + sheet + ".xml")) {
                        bytes = new String(bytes, StandardCharsets.UTF_8).replace("</worksheet>",
                            "<drawing r:id=\"rIdMigaLogo\"/></worksheet>").getBytes(StandardCharsets.UTF_8);
                    }
                    if (name.equals("xl/worksheets/_rels/sheet" + sheet + ".xml.rels")) {
                        bytes = new String(bytes, StandardCharsets.UTF_8).replace("</Relationships>",
                            "<Relationship Id=\"rIdMigaLogo\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../drawings/miga"
                            + sheet + ".xml\"/></Relationships>").getBytes(StandardCharsets.UTF_8);
                    }
                }
                put(zip, name, bytes);
            }
            put(zip, "xl/media/miga-wordmark.png", logo);
            for (int sheet = 1; sheet <= sheets; sheet++) {
                put(zip, "xl/drawings/miga" + sheet + ".xml", drawing(width, height).getBytes(StandardCharsets.UTF_8));
                put(zip, "xl/drawings/_rels/miga" + sheet + ".xml.rels", """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/miga-wordmark.png"/>
                    </Relationships>
                    """.strip().getBytes(StandardCharsets.UTF_8));
            }
        }
    }

    private static void put(ZipOutputStream zip, String name, byte[] value) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(value);
        zip.closeEntry();
    }

    private static String drawing(long width, long height) {
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <xdr:oneCellAnchor>
                <xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from>
                <xdr:ext cx="%d" cy="%d"/>
                <xdr:pic>
                  <xdr:nvPicPr><xdr:cNvPr id="1" name="Miga" descr="Logo oficial de Miga"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
                  <xdr:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
                  <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
                </xdr:pic>
                <xdr:clientData/>
              </xdr:oneCellAnchor>
            </xdr:wsDr>
            """.strip().formatted(width, height);
    }
}
