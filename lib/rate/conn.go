package rate

import (
	"io"
)

type rateConn struct {
	conn io.ReadWriteCloser
	rate *Rate
}

type directionalRateConn struct {
	conn      io.ReadWriteCloser
	readRate  *Rate
	writeRate *Rate
}

// NewDirectionalRateConn applies independent limiters to reads and writes, so
// download and upload are each capped at their own configured rate (equal values
// give a symmetric limit). Pass distinct *Rate instances (e.g. RateIn/RateOut);
// the two directions must not share a single bucket.
//
// The connection returned here already accounts for both directions, so it must
// not be handed to another rate-limited copier (goroutine.copyConns / Join),
// otherwise the same bytes would be charged twice.
func NewDirectionalRateConn(conn io.ReadWriteCloser, readRate, writeRate *Rate) io.ReadWriteCloser {
	if readRate == nil && writeRate == nil {
		return conn
	}
	return &directionalRateConn{conn: conn, readRate: readRate, writeRate: writeRate}
}

func (s *directionalRateConn) Read(b []byte) (n int, err error) {
	n, err = s.conn.Read(b)
	if s.readRate != nil && n > 0 {
		s.readRate.Get(int64(n))
	}
	return
}

func (s *directionalRateConn) Write(b []byte) (n int, err error) {
	if s.writeRate != nil && len(b) > 0 {
		s.writeRate.Get(int64(len(b)))
	}
	n, err = s.conn.Write(b)
	if s.writeRate != nil && len(b) > 0 && n < len(b) {
		s.writeRate.ReturnBucket(int64(len(b) - n))
	}
	return
}

func (s *directionalRateConn) Close() error {
	return s.conn.Close()
}

func NewRateConn(conn io.ReadWriteCloser, rate *Rate) io.ReadWriteCloser {
	return &rateConn{
		conn: conn,
		rate: rate,
	}
}

func (s *rateConn) Read(b []byte) (n int, err error) {
	n, err = s.conn.Read(b)
	if s.rate != nil && n > 0 {
		s.rate.Get(int64(n))
	}
	return
}

func (s *rateConn) Write(b []byte) (n int, err error) {
	if s.rate != nil && len(b) > 0 {
		s.rate.Get(int64(len(b)))
	}
	n, err = s.conn.Write(b)
	if s.rate != nil && len(b) > 0 && n < len(b) {
		s.rate.ReturnBucket(int64(len(b) - n))
	}
	return
}

func (s *rateConn) Close() error {
	return s.conn.Close()
}
