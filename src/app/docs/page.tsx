export const metadata = { title: "API Docs · Casa Andina" };

export default function DocsPage() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Casa Andina API · Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>body { margin: 0; background: #fff; }</style>
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = function() {
        window.ui = SwaggerUIBundle({
          url: '/openapi.yaml',
          dom_id: '#swagger',
          deepLinking: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
          tryItOutEnabled: true,
        });
      };
    </script>
  </body>
</html>`;

  return (
    <iframe
      srcDoc={html}
      style={{
        border: 0,
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    />
  );
}
