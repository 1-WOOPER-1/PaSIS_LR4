import re

from pydantic import BaseModel, SecretStr, field_validator

class RegistrationRequest(BaseModel):
    login: str
    password: SecretStr

    @field_validator("login")
    @classmethod
    def validate_login(cls, login: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", login):
            raise ValueError(
                "Логин должен содержать от 3 до 32 символов: "
                "латинские буквы, цифры, точку, подчёркивание или дефис."
            )
        return login

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: SecretStr) -> SecretStr:
        value = password.get_secret_value()

        if len(value) < 8:
            raise ValueError("Пароль должен содержать минимум 8 символов.")
        if not any(char.isupper() for char in value):
            raise ValueError("Добавьте в пароль заглавную букву.")
        if not any(char.islower() for char in value):
            raise ValueError("Добавьте в пароль строчную букву.")
        if not any(char.isdecimal() for char in value):
            raise ValueError("Добавьте в пароль цифру.")
        if not any(
            char.isprintable() and not char.isalnum() and not char.isspace()
            for char in value
        ):
            raise ValueError("Добавьте в пароль специальный символ.")

        return password

class LoginRequest(BaseModel):
    login: str
    password: SecretStr
