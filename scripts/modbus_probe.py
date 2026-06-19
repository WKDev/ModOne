# ModOne Modbus TCP 서버에 접속해 읽기/쓰기를 검증하는 테스트 클라이언트
import sys
from pymodbus.client import ModbusTcpClient

HOST, PORT = "127.0.0.1", 502


def call(fn, *args, **kw):
    """pymodbus 버전별 slave/device_id 키워드 차이를 흡수."""
    try:
        return fn(*args, slave=1, **kw)
    except TypeError:
        return fn(*args, device_id=1, **kw)


def main():
    c = ModbusTcpClient(HOST, port=PORT, timeout=3)
    if not c.connect():
        print("CONNECT FAIL")
        sys.exit(1)
    print(f"CONNECTED {HOST}:{PORT}")

    rr = call(c.read_holding_registers, 0, count=10)
    print("HOLDING[0:10] :", "ERR " + str(rr) if rr.isError() else rr.registers)

    rc = call(c.read_coils, 0, count=8)
    print("COILS[0:8]    :", "ERR " + str(rc) if rc.isError() else rc.bits)

    # write-then-read roundtrip on holding register 0
    wv = 12345
    wr = call(c.write_register, 0, wv)
    rb = call(c.read_holding_registers, 0, count=1)
    ok = (not wr.isError()) and (not rb.isError()) and rb.registers[0] == wv
    print(f"WRITE reg0={wv} -> readback={None if rb.isError() else rb.registers[0]}  {'OK' if ok else 'MISMATCH'}")

    # write-then-read roundtrip on coil 0
    cw = call(c.write_coil, 0, True)
    cb = call(c.read_coils, 0, count=1)
    cok = (not cw.isError()) and (not cb.isError()) and cb.bits[0] is True
    print(f"WRITE coil0=True -> readback={None if cb.isError() else cb.bits[0]}  {'OK' if cok else 'MISMATCH'}")

    c.close()
    print("RESULT:", "PASS" if (ok and cok) else "PARTIAL/CHECK")


if __name__ == "__main__":
    main()
