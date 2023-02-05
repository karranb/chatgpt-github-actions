import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_starter/app/auth/domain/repositories/auth_repository.dart';
import 'package:flutter_starter/app/core/domain/models/request_status.dart';
import 'package:flutter_starter/app/core/domain/repositories/token_repository.dart';
import 'package:flutter_starter/constants/all.dart';
import 'package:flutter_starter/utils/validator_utils.dart';

part 'reset_password_event.dart';
part 'reset_password_state.dart';

class ResetPasswordBloc extends Bloc<ResetPasswordEvent, ResetPasswordState> {
  final AuthRepository _authRepository;
  final TokenRepository _tokenRepository;
  StreamSubscription<int>? timerStream;

  ResetPasswordBloc({
    required AuthRepository authRepository,
    required TokenRepository tokenRepository,
  })  : _authRepository = authRepository,
        _tokenRepository = tokenRepository,
        super(ResetPasswordState.initial()) {
    on<RequestCode>(_onRequestCode);
    on<StartTimer>(_onStartTimer);
    on<TimerRunning>(_onTimerRunning);
    on<ValidateCode>(_onValidateCode);
    on<ValidateNewPassword>(_onValidateNewPassword);
    on<SetNewPassword>(_onSetNewPassword);
  }

  @override
  Future<void> close() async {
    await timerStream?.cancel();
    await super.close();
  }

  Stream<T> _createCounterStream<T>(
    T Function(int) computation,
  ) async* {
    yield computation(0);
    yield* Stream.periodic(
      const Duration(seconds: 1),
      (int seconds) {
        return computation(seconds + 1);
      },
    );
  }

  Future<void> _onStartTimer(StartTimer event, Emitter emit) async {
    await timerStream?.cancel();
    timerStream = _createCounterStream((int seconds) => seconds)
        .take(minuteInSeconds)
        .listen((int seconds) {
      add(TimerRunning(seconds: seconds));
    });
  }

  Future<void> _onTimerRunning(TimerRunning event, Emitter emit) async {
    emit(state.copyWith(secondsRemaining: minuteInSeconds - event.seconds - 1));
  }

  Future<void> _onRequestCode(RequestCode event, Emitter emit) async {
    emit(state.copyWith(resetPasswordStatus: const Loading()));

    final response = await _authRepository.requestCode(
      email: event.email,
    );

    emit(state.copyWith(resetPasswordStatus: response));
  }

  Future<void> _onValidateCode(ValidateCode event, Emitter emit) async {
    emit(state.copyWith(validateCodeStatus: const Loading()));

    final response = await _authRepository.validateCode(
      email: event.email,
      code: event.code,
    );

    response.when(
      success: ((data) async {
        if (data != null) {
          await _tokenRepository.setToken(data.accessToken);
        }
      }),
    );

    emit(state.copyWith(validateCodeStatus: response));
  }

  void _onValidateNewPassword(ValidateNewPassword event, Emitter emit) {
    emit(
      state.copyWith(
        isNewPasswordValid: isPasswordValid(event.newPassword) &&
            event.newPassword == event.confirmNewPassword,
      ),
    );
  }

  Future<void> _onSetNewPassword(SetNewPassword event, Emitter emit) async {
    emit(state.copyWith(resetPasswordStatus: const Loading()));

    final response = await _authRepository.setNewPassword(
      email: event.email!,
      password: event.password!,
    );

    emit(state.copyWith(resetPasswordStatus: response));
  }
}