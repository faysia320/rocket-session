"""Tests for FilesystemService."""

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services.filesystem_service import FilesystemService
from app.schemas.filesystem import (
    DirectoryEntry,
    DirectoryListResponse,
    GitInfo,
    SkillInfo,
    SkillListResponse,
)


class TestValidatePath:
    """Tests for _validate_path method."""

    @pytest.mark.asyncio
    async def test_validate_path_success(self, filesystem_service):
        """Valid path should return resolved Path object."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = filesystem_service._validate_path(tmpdir)
            assert isinstance(result, Path)
            assert result.exists()
            assert str(result) == str(Path(tmpdir).resolve())

    @pytest.mark.asyncio
    async def test_validate_path_nonexistent(self, filesystem_service):
        """Nonexistent path should raise ValueError."""
        with pytest.raises(ValueError, match="경로가 존재하지 않습니다"):
            filesystem_service._validate_path("/nonexistent/path/12345")

    @pytest.mark.asyncio
    async def test_validate_path_tilde_expansion(self, filesystem_service):
        """Path with tilde should expand to home directory."""
        result = filesystem_service._validate_path("~")
        assert result == Path.home()


class TestListDirectory:
    """Tests for list_directory method."""

    @pytest.mark.asyncio
    async def test_list_directory_success(self, filesystem_service):
        """Should return list of subdirectories."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create subdirectories
            (Path(tmpdir) / "dir1").mkdir()
            (Path(tmpdir) / "dir2").mkdir()
            (Path(tmpdir) / "file.txt").touch()

            result = await filesystem_service.list_directory(tmpdir)

            assert isinstance(result, DirectoryListResponse)
            assert result.path == str(Path(tmpdir).resolve())
            assert len(result.entries) == 2
            assert all(e.is_dir for e in result.entries)
            assert {e.name for e in result.entries} == {"dir1", "dir2"}

    @pytest.mark.asyncio
    async def test_list_directory_excludes_hidden(self, filesystem_service):
        """Should exclude hidden directories."""
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "visible").mkdir()
            (Path(tmpdir) / ".hidden").mkdir()

            result = await filesystem_service.list_directory(tmpdir)

            assert len(result.entries) == 1
            assert result.entries[0].name == "visible"

    @pytest.mark.asyncio
    async def test_list_directory_excludes_files(self, filesystem_service):
        """Should not include files in the list."""
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "mydir").mkdir()
            (Path(tmpdir) / "file1.txt").touch()
            (Path(tmpdir) / "file2.md").touch()

            result = await filesystem_service.list_directory(tmpdir)

            assert len(result.entries) == 1
            assert result.entries[0].name == "mydir"

    @pytest.mark.asyncio
    async def test_list_directory_detects_git_repo(self, filesystem_service):
        """Should detect .git folder and set is_git_repo=True."""
        with tempfile.TemporaryDirectory() as tmpdir:
            git_dir = Path(tmpdir) / "git-project"
            git_dir.mkdir()
            (git_dir / ".git").mkdir()

            result = await filesystem_service.list_directory(tmpdir)

            assert len(result.entries) == 1
            assert result.entries[0].name == "git-project"
            assert result.entries[0].is_git_repo is True

    @pytest.mark.asyncio
    async def test_list_directory_parent_calculation(self, filesystem_service):
        """Should correctly calculate parent directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "subdir"
            subdir.mkdir()

            result = await filesystem_service.list_directory(str(subdir))

            assert result.parent == str(Path(tmpdir).resolve())

    @pytest.mark.asyncio
    async def test_list_directory_not_a_directory(self, filesystem_service):
        """Should raise ValueError if path is not a directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "file.txt"
            file_path.touch()

            with pytest.raises(ValueError, match="디렉토리가 아닙니다"):
                await filesystem_service.list_directory(str(file_path))


class TestListSkills:
    """Tests for list_skills method."""

    @pytest.mark.asyncio
    async def test_list_skills_project_only(self, filesystem_service):
        """Should list project skills from .claude/commands/*.md."""
        with tempfile.TemporaryDirectory() as tmpdir:
            commands_dir = Path(tmpdir) / ".claude" / "commands"
            commands_dir.mkdir(parents=True)

            (commands_dir / "skill1.md").write_text("First line of skill1\nMore content")
            (commands_dir / "skill2.md").write_text("First line of skill2")

            result = await filesystem_service.list_skills(tmpdir)

            assert isinstance(result, SkillListResponse)
            assert len(result.skills) == 2
            assert all(s.scope == "project" for s in result.skills)

            skill_map = {s.name: s for s in result.skills}
            assert "skill1" in skill_map
            assert skill_map["skill1"].description == "First line of skill1"
            assert "skill2" in skill_map
            assert skill_map["skill2"].description == "First line of skill2"

    @pytest.mark.asyncio
    async def test_list_skills_project_priority(self, filesystem_service):
        """Project skills should take priority over user skills with same name."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Setup project skill
            project_commands = Path(tmpdir) / ".claude" / "commands"
            project_commands.mkdir(parents=True)
            (project_commands / "duplicate.md").write_text("Project version")

            # Setup user skill (mock home directory)
            user_home = Path(tmpdir) / "fake-home"
            user_commands = user_home / ".claude" / "commands"
            user_commands.mkdir(parents=True)
            (user_commands / "duplicate.md").write_text("User version")
            (user_commands / "user-only.md").write_text("User only skill")

            with patch("pathlib.Path.home", return_value=user_home):
                result = await filesystem_service.list_skills(tmpdir)

            # Should have 2 skills: duplicate (project) + user-only
            assert len(result.skills) == 2

            duplicate = next(s for s in result.skills if s.name == "duplicate")
            assert duplicate.scope == "project"
            assert duplicate.description == "Project version"

            user_only = next(s for s in result.skills if s.name == "user-only")
            assert user_only.scope == "user"

    @pytest.mark.asyncio
    async def test_list_skills_empty_path_user_only(self, filesystem_service):
        """Empty path should return only user skills."""
        user_home = Path(tempfile.gettempdir()) / "test-user-home"
        user_commands = user_home / ".claude" / "commands"
        user_commands.mkdir(parents=True, exist_ok=True)

        try:
            (user_commands / "user-skill.md").write_text("User skill description")

            with patch("pathlib.Path.home", return_value=user_home):
                result = await filesystem_service.list_skills("")

            assert len(result.skills) == 1
            assert result.skills[0].name == "user-skill"
            assert result.skills[0].scope == "user"
        finally:
            # Cleanup
            import shutil
            if user_home.exists():
                shutil.rmtree(user_home)


class TestExtractFirstLine:
    """Tests for _extract_first_line method."""

    @pytest.mark.asyncio
    async def test_extract_first_line_success(self, filesystem_service):
        """Should extract first non-empty line."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.md"
            file_path.write_text("\n\nFirst line\nSecond line")

            result = filesystem_service._extract_first_line(file_path)

            assert result == "First line"

    @pytest.mark.asyncio
    async def test_extract_first_line_empty_file(self, filesystem_service):
        """Empty file should return empty string."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "empty.md"
            file_path.write_text("")

            result = filesystem_service._extract_first_line(file_path)

            assert result == ""

    @pytest.mark.asyncio
    async def test_extract_first_line_nonexistent_file(self, filesystem_service):
        """Nonexistent file should return empty string."""
        result = filesystem_service._extract_first_line(Path("/nonexistent/file.md"))
        assert result == ""


class TestRunGitCommand:
    """Tests for _run_git_command method (mocked)."""

    @pytest.mark.asyncio
    async def test_run_git_command_success(self, filesystem_service):
        """Should return (0, stdout, stderr) on success."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_result = AsyncMock(return_value=(0, "output", ""))

            with patch.object(filesystem_service, '_run_git_command', mock_result):
                returncode, stdout, stderr = await filesystem_service._run_git_command(
                    "status", cwd=tmpdir
                )

                assert returncode == 0
                assert stdout == "output"
                assert stderr == ""

    @pytest.mark.asyncio
    async def test_run_git_command_failure(self, filesystem_service):
        """Should return non-zero returncode on failure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_result = AsyncMock(return_value=(128, "", "fatal: not a git repository"))

            with patch.object(filesystem_service, '_run_git_command', mock_result):
                returncode, stdout, stderr = await filesystem_service._run_git_command(
                    "status", cwd=tmpdir
                )

                assert returncode == 128
                assert "fatal: not a git repository" in stderr


class TestGetGitInfo:
    """Tests for get_git_info method (mocked)."""

    @pytest.mark.asyncio
    async def test_get_git_info_not_a_repo(self, filesystem_service):
        """Non-git directory should return is_git_repo=False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Mock _run_git_command to return failure for rev-parse
            async def mock_run(*args, **kwargs):
                if "rev-parse" in args:
                    return (128, "", "fatal: not a git repository")
                return (0, "", "")

            with patch.object(filesystem_service, '_run_git_command', side_effect=mock_run):
                result = await filesystem_service.get_git_info(tmpdir)

                assert isinstance(result, GitInfo)
                assert result.is_git_repo is False

    @pytest.mark.asyncio
    async def test_get_git_info_cache(self, filesystem_service):
        """Should cache git info for TTL duration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            call_count = 0

            async def mock_fetch(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                return GitInfo(is_git_repo=True, branch="main")

            with patch.object(filesystem_service, '_fetch_git_info', side_effect=mock_fetch):
                # First call
                result1 = await filesystem_service.get_git_info(tmpdir)
                # Second call (should use cache)
                result2 = await filesystem_service.get_git_info(tmpdir)

                assert call_count == 1  # Should only call _fetch_git_info once
                assert result1 == result2
                assert result1.branch == "main"
