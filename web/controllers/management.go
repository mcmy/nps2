package controllers

import (
	"bytes"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/beego/beego"
	"github.com/djylb/nps/lib/common"
	"github.com/djylb/nps/lib/crypt"
	"github.com/djylb/nps/server"
)

// ManagementController serves the migrated UI shell. Data and mutations stay
// on the existing Beego controller endpoints.
type ManagementController struct {
	beego.Controller
}

func (s *ManagementController) Index() {
	filename := filepath.Join(common.GetRunPath(), "web", "static", "app", "index.html")
	body, err := os.ReadFile(filename)
	if err != nil {
		s.CustomAbort(http.StatusNotFound, "management UI is not installed")
		return
	}
	base := strings.TrimRight(beego.AppConfig.String("web_base_url"), "/")
	cacheVersion := server.GetVersion()
	body = bytes.ReplaceAll(body, []byte(`/static/app/assets/app.css`), []byte(`/static/app/assets/app.css?v=`+cacheVersion))
	body = bytes.ReplaceAll(body, []byte(`/static/app/assets/app.js`), []byte(`/static/app/assets/app.js?v=`+cacheVersion))
	body = bytes.ReplaceAll(body, []byte(`/static/app/assets/client.js`), []byte(`/static/app/assets/client.js?v=`+cacheVersion))
	body = bytes.ReplaceAll(body, []byte("__NPS_BASE__"), []byte(base))
	if base != "" {
		body = bytes.ReplaceAll(body, []byte(`"/static/app/`), []byte(`"`+base+`/static/app/`))
	}
	s.Ctx.Output.ContentType("text/html")
	s.Ctx.Output.Body(body)
}

// Meta exposes only the existing login protocol state needed by the new UI.
// Authentication itself is still handled by LoginController.Verify.
func (s *ManagementController) Meta() {
	nonce := crypt.GetRandomString(16)
	s.SetSession("login_nonce", nonce)
	publicKey, _ := crypt.GetRSAPublicKeyPEM()
	base := strings.TrimRight(beego.AppConfig.String("web_base_url"), "/")
	basePath := func(path string) string { return base + path }
	// Publish the legacy controller surface in the action catalog consumed by
	// the migrated UI. The handlers remain responsible for the existing
	// session and per-client authorization checks.
	actions := []map[string]interface{}{
		{"resource": "clients", "action": "list", "method": "POST", "path": basePath("/client/list")},
		{"resource": "clients", "action": "read", "method": "POST", "path": basePath("/client/getclient?id={id}")},
		{"resource": "clients", "action": "create", "method": "POST", "path": basePath("/client/add")},
		{"resource": "clients", "action": "update", "method": "POST", "path": basePath("/client/edit?id={id}")},
		{"resource": "clients", "action": "delete", "method": "POST", "path": basePath("/client/del?id={id}")},
		{"resource": "clients", "action": "status", "method": "POST", "path": basePath("/client/changestatus?id={id}")},
		{"resource": "clients", "action": "clear", "method": "POST", "path": basePath("/client/clear?id={id}")},
		{"resource": "clients", "action": "ping", "method": "POST", "path": basePath("/client/pingclient?id={id}")},
		{"resource": "clients", "action": "qrcode", "method": "GET", "path": basePath("/client/qr")},
		{"resource": "tunnels", "action": "list", "method": "POST", "path": basePath("/index/gettunnel")},
		{"resource": "tunnels", "action": "read", "method": "POST", "path": basePath("/index/getonetunnel?id={id}")},
		{"resource": "tunnels", "action": "create", "method": "POST", "path": basePath("/index/add")},
		{"resource": "tunnels", "action": "update", "method": "POST", "path": basePath("/index/edit?id={id}")},
		{"resource": "tunnels", "action": "delete", "method": "POST", "path": basePath("/index/del?id={id}")},
		{"resource": "tunnels", "action": "start", "method": "POST", "path": basePath("/index/start?id={id}")},
		{"resource": "tunnels", "action": "stop", "method": "POST", "path": basePath("/index/stop?id={id}")},
		{"resource": "tunnels", "action": "clear", "method": "POST", "path": basePath("/index/clear?id={id}&mode=flow")},
		{"resource": "hosts", "action": "list", "method": "POST", "path": basePath("/index/hostlist")},
		{"resource": "hosts", "action": "read", "method": "POST", "path": basePath("/index/gethost?id={id}")},
		{"resource": "hosts", "action": "create", "method": "POST", "path": basePath("/index/addhost")},
		{"resource": "hosts", "action": "update", "method": "POST", "path": basePath("/index/edithost?id={id}")},
		{"resource": "hosts", "action": "delete", "method": "POST", "path": basePath("/index/delhost?id={id}")},
		{"resource": "hosts", "action": "start", "method": "POST", "path": basePath("/index/starthost?id={id}")},
		{"resource": "hosts", "action": "stop", "method": "POST", "path": basePath("/index/stophost?id={id}")},
		{"resource": "hosts", "action": "clear", "method": "POST", "path": basePath("/index/clearhost?id={id}&mode=flow")},
	}
	meta := map[string]interface{}{
		"app": map[string]interface{}{"name": "NPS", "version": server.GetVersion()},
		"session": map[string]interface{}{
			"authenticated": s.GetSession("auth") == true,
			"is_admin":      s.GetSession("isAdmin") == true,
			"username":      s.GetSession("username"),
		},
		"public_key":  publicKey,
		"login_nonce": nonce,
		"login_delay": BanTime * 1000,
		"totp_len":    crypt.TotpLen,
		"pow_bits":    powBits,
		"pow_enable":  forcePow,
		"captcha":     nil,
		"actions":     actions,
		"routes": map[string]interface{}{
			"meta": base + "/management/meta", "session": base + "/login/verify",
			"logout": base + "/login/out", "overview": base + "/index/stats",
			"clients": base + "/client/list",
		},
		"features": map[string]interface{}{
			"allow_user_register":        false,
			"allow_flow_limit":           beego.AppConfig.DefaultBool("allow_flow_limit", false),
			"allow_rate_limit":           beego.AppConfig.DefaultBool("allow_rate_limit", false),
			"allow_time_limit":           beego.AppConfig.DefaultBool("allow_time_limit", false),
			"allow_connection_num_limit": beego.AppConfig.DefaultBool("allow_connection_num_limit", false),
			"allow_multi_ip":             beego.AppConfig.DefaultBool("allow_multi_ip", false),
			"allow_tunnel_num_limit":     beego.AppConfig.DefaultBool("allow_tunnel_num_limit", false),
			"allow_local_proxy":          beego.AppConfig.DefaultBool("allow_local_proxy", false),
		},
	}
	if beego.AppConfig.DefaultBool("open_captcha", false) && cpt != nil {
		if id, err := cpt.CreateCaptcha(); err == nil {
			meta["captcha"] = map[string]interface{}{"id": id, "url": base + "/captcha/" + id + ".png"}
		}
	}
	s.Data["json"] = meta
	s.ServeJSON()
}
