FROM ghcr.io/oraios/serena:latest

# /workspaces 볼륨 마운트와 충돌을 방지하기 위해
# Serena 설치를 /opt/serena로 복사
RUN cp -a /workspaces/serena /opt/serena

# 작업 디렉토리와 환경 변수를 새 위치로 업데이트
WORKDIR /opt/serena
ENV PATH="/opt/serena/.venv/bin:${PATH}"

# ENTRYPOINT를 새 경로에 맞게 업데이트
ENTRYPOINT ["/bin/bash", "-c", "source /opt/serena/.venv/bin/activate && exec $0 \"$@\""]
