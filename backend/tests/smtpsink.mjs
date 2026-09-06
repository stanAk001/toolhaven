/**
 * A throwaway SMTP server that accepts everything and remembers what it was
 * given. Enough of the protocol for nodemailer to complete a handshake, and no
 * more — this exists so the duplicate-email guard can be tested against real
 * successful sends without mailing a real person.
 */
import net from "node:net";

export function startSink(port = 2525) {
  const received = [];
  const server = net.createServer((sock) => {
    let data = "", inData = false;
    sock.write("220 sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      const text = chunk.toString();
      if (inData) {
        data += text;
        if (data.includes("\r\n.\r\n")) {
          const body = data.slice(0, data.indexOf("\r\n.\r\n"));
          const subject = (body.match(/^Subject: (.*)$/mi) || [])[1] || "";
          const to = (body.match(/^To: (.*)$/mi) || [])[1] || "";
          received.push({ subject: subject.trim(), to: to.trim() });
          inData = false; data = "";
          sock.write("250 2.0.0 Ok: queued\r\n");
        }
        return;
      }
      for (const line of text.split("\r\n").filter(Boolean)) {
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) sock.write("250-sink\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("AUTH")) sock.write("235 2.7.0 Accepted\r\n");
        else if (cmd.startsWith("MAIL FROM") || cmd.startsWith("RCPT TO")) sock.write("250 2.1.0 Ok\r\n");
        else if (cmd.startsWith("DATA")) { inData = true; sock.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
        else if (cmd.startsWith("QUIT")) { sock.write("221 2.0.0 Bye\r\n"); sock.end(); }
        else sock.write("250 2.0.0 Ok\r\n");
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, received })));
}
