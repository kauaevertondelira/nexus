package br.com.nexus.industrial;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** O APK abre o mesmo site HTTPS. Login, permissões e banco pertencem à aplicação web. */
public class MainActivity extends Activity {
    private static final int CAMERA_REQUEST = 10, FILE_REQUEST = 11;
    private WebView web;
    private String site;
    private PermissionRequest pendingCamera;
    private ValueCallback<Uri[]> pendingFile;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        site = getPreferences(MODE_PRIVATE).getString("site", "");
        if (site.isEmpty()) showSetup(); else openSite();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void showSetup() {
        destroyWeb();
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(24), dp(52), dp(24), dp(24));
        content.setBackgroundColor(Color.rgb(244, 245, 239));
        TextView brand = new TextView(this);
        brand.setText("NEXUS"); brand.setTextSize(36); brand.setTextColor(Color.rgb(32, 76, 255));
        content.addView(brand);
        TextView message = new TextView(this);
        message.setText("Conectar ao sistema\n\nInforme o endereço HTTPS da Nexus publicada. O aplicativo usa a mesma conta, as mesmas máquinas e o mesmo banco da versão web.\n");
        message.setTextSize(17); content.addView(message);
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint("https://seu-dominio/nexus/"); address.setText(site);
        address.setContentDescription("Endereço HTTPS da Nexus"); content.addView(address);
        Button connect = new Button(this); connect.setText("Conectar à Nexus"); content.addView(connect);
        connect.setOnClickListener(v -> {
            try {
                Uri uri = Uri.parse(address.getText().toString().trim());
                if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) throw new IllegalArgumentException();
                String path = uri.getPath() == null ? "/" : uri.getPath();
                if (path.endsWith(".html")) path = path.substring(0, path.lastIndexOf('/') + 1);
                if (!path.endsWith("/")) path += "/";
                site = uri.buildUpon().path(path).clearQuery().fragment(null).build().toString();
                getPreferences(MODE_PRIVATE).edit().putString("site", site).apply();
                openSite();
            } catch (IllegalArgumentException error) { address.setError("Informe o endereço HTTPS válido da pasta da Nexus."); }
        });
        setContentView(content);
        if (!site.isEmpty()) {
            Button cancel = new Button(this); cancel.setText("Voltar ao sistema"); content.addView(cancel);
            cancel.setOnClickListener(v -> openSite());
        }
    }

    private boolean sameOrigin(Uri uri) {
        Uri configured = Uri.parse(site);
        return "https".equals(uri.getScheme()) && configured.getHost() != null && configured.getHost().equalsIgnoreCase(uri.getHost())
            && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private boolean insideSite(Uri uri) {
        return sameOrigin(uri) && uri.getPath() != null && uri.getPath().startsWith(Uri.parse(site).getPath());
    }

    @SuppressLint("SetJavaScriptEnabled") private void openSite() {
        destroyWeb();
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (insideSite(uri)) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()) || "tel".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) new AlertDialog.Builder(MainActivity.this).setTitle("Não foi possível abrir a Nexus")
                    .setMessage("Confira a conexão e o endereço publicado do sistema.")
                    .setPositiveButton("Tentar novamente", (d, w) -> { if (web != null) web.loadUrl(site); })
                    .setNegativeButton("Editar endereço", (d, w) -> showSetup()).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                boolean video = false;
                for (String resource : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
                if (!video || !sameOrigin(request.getOrigin()) || web == null || web.getUrl() == null || !insideSite(Uri.parse(web.getUrl()))) { request.deny(); return; }
                if (pendingCamera != null) pendingCamera.deny();
                pendingCamera = request;
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) grantCamera();
                else requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (pendingCamera == request) pendingCamera = null; }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); return true; }
                catch (ActivityNotFoundException ignored) { pendingFile = null; return false; }
            }
        });
        // O layout web mantém sua identidade; as margens respeitam as barras do Android.
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(web);
        web.loadUrl(site);
    }

    private void grantCamera() {
        if (pendingCamera == null) return;
        if (web != null && web.getUrl() != null && insideSite(Uri.parse(web.getUrl())) && sameOrigin(pendingCamera.getOrigin())) {
            pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else pendingCamera.deny();
        pendingCamera = null;
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == CAMERA_REQUEST && pendingCamera != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) grantCamera();
            else { pendingCamera.deny(); pendingCamera = null; }
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && pendingFile != null) { pendingFile.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); pendingFile = null; }
    }
    @Override protected void onPause() {
        if (web != null) { if (pendingCamera == null) web.evaluateJavascript("window.Nexus?.pauseProductionCamera?.()", null); web.onPause(); }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
    @Override protected void onStop() {
        if (web != null) web.evaluateJavascript("window.Nexus?.pauseProductionCamera?.()", null);
        if (pendingCamera != null) { pendingCamera.deny(); pendingCamera = null; }
        super.onStop();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        new AlertDialog.Builder(this).setTitle("Nexus Industrial").setItems(new String[]{"Continuar no sistema", "Configurar endereço", "Fechar aplicativo"}, (d, which) -> {
            if (which == 1) showSetup(); else if (which == 2) finish();
        }).show();
    }
    private void destroyWeb() {
        if (pendingCamera != null) { pendingCamera.deny(); pendingCamera = null; }
        if (pendingFile != null) { pendingFile.onReceiveValue(null); pendingFile = null; }
        if (web != null) { web.destroy(); web = null; }
    }
    @Override protected void onDestroy() { destroyWeb(); super.onDestroy(); }
}
