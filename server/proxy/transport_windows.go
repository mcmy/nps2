//go:build windows
// +build windows

package proxy

import (
	"github.com/mcmy/nps2/lib/conn"
)

func HandleTrans(c *conn.Conn, s *TunnelModeServer) error {
	return nil
}
